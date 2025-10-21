import { GoogleGenAI, LiveServerMessage, Modality, Blob, LiveSession } from "@google/genai";
import type { TranscriptMessage } from '../types';

// --- Audio Encoding/Decoding Helpers ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const chData = buffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) chData[i] = dataInt16[i * numChannels + ch] / 32768.0;
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

// --- Gemini Live Service ---
export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private outputGainNode: GainNode | null = null;
  private nextStartTime = 0;
  private audioSources = new Set<AudioBufferSourceNode>();
  private sessionPromise: Promise<LiveSession> | null = null;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  constructor() {
    if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async connect(
    onMessage: (message: TranscriptMessage) => void,
    onStatusChange: (status: 'live' | 'error' | 'disconnected') => void,
  ): Promise<void> {
    this.inputAudioContext  = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputGainNode = this.outputAudioContext.createGain();
    this.outputGainNode.connect(this.outputAudioContext.destination);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          onStatusChange('live');
          if(!this.inputAudioContext) return;
          this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
          this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

          this.scriptProcessor.onaudioprocess = (ev) => {
            const inputData = ev.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            this.sessionPromise?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
          };

          this.mediaStreamSource.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => this.handleServerMessage(message, onMessage),
        onerror: (e: ErrorEvent) => {
          console.error('Gemini Live Error:', e);
          onStatusChange('error');
          onMessage({ speaker: 'System', text: 'Connection error. Please try again.' });
        },
        onclose: () => {
          onStatusChange('disconnected');
          this.cleanup();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `
You are “Emre” — CSR agent of **Turkish Airlines**.

GOAL
- Sound like a human Turkish Airlines agent: warm, calm, and efficient.
- Give concise, actionable answers that are easy to follow on a phone call.
- Protect privacy and follow airline policy. Never reveal engines, model names, or internal systems.
- If asked “who are you?”, say: “I’m Emre, Representative from Turkish Airlines.”

SSML MANDATE (EVERY REPLY)
- You must output **valid SSML only**, never plain text.
- Always wrap your content exactly like this:
  <Say voice="alice" language="en-US">
    <prosody rate="92%" pitch="-2st" volume="-1dB"> …your spoken content… </prosody>
  </Say>
- Keep responses ≤ 400 characters to reduce call latency.
- Insert natural pacing with <break/> tags (e.g., <break time="0.4s"/> after greetings, before important numbers).

ACCEPTABLE AUDIO/SSML TAGS (STYLE ONLY — DO NOT READ THEM ALOUD)
- <prosody rate="…" pitch="…" volume="…"> … </prosody>
- <break time="0.3s|0.6s|1s"/>
- <emphasis level="moderate|strong">…</emphasis> for flight numbers, gates, fees.
- <say-as interpret-as="characters">…</say-as> for booking codes (e.g., R7K9QF).
- <say-as interpret-as="date">…</say-as> for dates.
- <say-as interpret-as="time">…</say-as> for times.
NEVER speak the tags. They are instructions to the TTS engine only.

DELIVERY & TONE
- Greeting pattern: brief welcome → offer help → short pause.
  Example:
  <Say voice="alice" language="en-US"><prosody rate="92%" pitch="-2st" volume="-1dB">
  Welcome to Turkish Airlines. <break time="0.5s"/> How may I assist you today?
  </prosody></Say>
- Clarify gently when needed: ask for booking code, full name as on ticket, travel date.
- Acknowledge emotion first if the caller is upset, then provide steps.
- Confirm actions and next steps clearly (fees, timing, confirmation).

CONTENT GUARDRAILS
- No promises beyond policy. If unsure, invite clarification or offer to check.
- If you cannot comply, return a short, polite SSML apology and ask for what’s needed:
  <Say voice="alice" language="en-US"><prosody rate="92%" pitch="-1st" volume="-1dB">
  I’m sorry. <break time="0.4s"/> I didn’t catch that. Please repeat your booking code slowly.
  </prosody></Say>

EXAMPLES YOU MAY EMULATE (ADAPT BRIEFLY, KEEP ≤400 CHARS)
- Change request:
  <Say voice="alice" language="en-US"><prosody rate="92%" pitch="-2st" volume="-1dB">
  I can help with that. <break time="0.4s"/> Please share your booking code. I’ll read it back to confirm.
  </prosody></Say>
- Time confirmation with emphasis:
  <Say voice="alice" language="en-US"><prosody rate="92%" pitch="-2st" volume="-1dB">
  Your new departure is <emphasis level="moderate"><say-as interpret-as="time">21:20</say-as></emphasis>. <break time="0.5s"/> Anything else today?
  </prosody></Say>
        `.trim(),
      },
    });
  }

  private async handleServerMessage(message: LiveServerMessage, onMessage: (message: TranscriptMessage) => void) {
    // Transcriptions
    if (message.serverContent?.inputTranscription) {
      const t = message.serverContent.inputTranscription.text || '';
      if (message.serverContent.inputTranscription.isFinal) {
        onMessage({ speaker: 'Caller', text: this.currentInputTranscription + t });
        this.currentInputTranscription = '';
      } else {
        this.currentInputTranscription += t;
      }
    }
    if (message.serverContent?.outputTranscription) {
      const t = message.serverContent.outputTranscription.text || '';
      if (message.serverContent.outputTranscription.isFinal) {
        onMessage({ speaker: 'Agent', text: this.currentOutputTranscription + t });
        this.currentOutputTranscription = '';
      } else {
        this.currentOutputTranscription += t;
      }
    }

    // Audio playback
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputGainNode) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const audioBuffer = await decodeAudioData(decode(base64Audio), this.outputAudioContext, 24000, 1);
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputGainNode);
      source.addEventListener('ended', () => { this.audioSources.delete(source); });
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.audioSources.add(source);
    }

    // Interruptions
    if (message.serverContent?.interrupted) {
      for (const s of this.audioSources.values()) { s.stop(); this.audioSources.delete(s); }
      this.nextStartTime = 0;
    }
  }

  public async summarize(transcript: string): Promise<string> {
    if (!transcript) return "No conversation to summarize.";
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Summarize the following customer service conversation into key points and action items:\n\n${transcript}`,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
      });
      return response.text;
    } catch (err) {
      console.error("Summarization error:", err);
      return "Could not generate summary.";
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      session.close();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.scriptProcessor?.disconnect();
    this.mediaStreamSource?.disconnect();
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.scriptProcessor = null;
    this.mediaStreamSource = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.sessionPromise = null;
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';
  }
}