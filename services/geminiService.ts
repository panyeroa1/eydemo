
import { GoogleGenAI, LiveServerMessage, Modality, Blob, LiveSession } from "@google/genai";
import type { TranscriptMessage } from '../types';

// --- Audio Encoding/Decoding Helpers ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
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
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async connect(
    onMessage: (message: TranscriptMessage) => void,
    onStatusChange: (status: 'live' | 'error' | 'disconnected') => void,
  ): Promise<void> {
    
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
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
          
          this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            if (this.sessionPromise) {
              this.sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            }
          };

          this.mediaStreamSource.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          this.handleServerMessage(message, onMessage);
        },
        onerror: (e: ErrorEvent) => {
          console.error('Gemini Live Error:', e);
          onStatusChange('error');
          onMessage({ speaker: 'System', text: 'Connection error. Please try again.' });
        },
        onclose: (e: CloseEvent) => {
          onStatusChange('disconnected');
          this.cleanup();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are “Eburon CSR Studio” — a real-time conversational CSR assistant. You speak naturally, succinctly, and helpfully. You never disclose internal engines or model names. If asked “who are you?”, answer: “I’m a customer service assistant.” You follow company policy, protect private data, and keep a calm presence in every situation.`
      },
    });
  }

  private async handleServerMessage(message: LiveServerMessage, onMessage: (message: TranscriptMessage) => void) {
    // Handle transcriptions
    if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      if (message.serverContent.inputTranscription.isFinal) {
         onMessage({ speaker: 'Caller', text: this.currentInputTranscription + text });
         this.currentInputTranscription = '';
      } else {
        this.currentInputTranscription += text;
      }
    }
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      if (message.serverContent.outputTranscription.isFinal) {
        onMessage({ speaker: 'Agent', text: this.currentOutputTranscription + text });
        this.currentOutputTranscription = '';
      } else {
        this.currentOutputTranscription += text;
      }
    }

    // Handle audio playback
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
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
    
    if (message.serverContent?.interrupted) {
      for (const source of this.audioSources.values()) {
        source.stop();
        this.audioSources.delete(source);
      }
      this.nextStartTime = 0;
    }
  }

  public async summarize(transcript: string): Promise<string> {
    if (!transcript) return "No conversation to summarize.";
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro', // Use Pro for complex summarization
        contents: `Summarize the following customer service conversation into key points and action items:\n\n${transcript}`,
        config: {
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });
      return response.text;
    } catch (error) {
      console.error("Summarization error:", error);
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
