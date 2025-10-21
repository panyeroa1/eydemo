
export interface QueueItem {
  id: string;
  callerName: string;
  priority: 'High' | 'Normal';
  waitTime: number;
  segment?: string;
  locale?: string;
  intent?: string;
  sentiment?: 'Positive' | 'Neutral+' | 'Negative';
  interactionHistory?: Array<{ date: string; summary: string }>;
}

export interface TranscriptMessage {
  speaker: 'Caller' | 'Agent' | 'System' | 'Coach';
  text: string;
  isCoach?: boolean;
}

export type AssistantTab = 'assist' | 'translate' | 'policies' | 'summary';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'live' | 'error';

export interface AgentPersona {
  id: string;
  name: string;
  avatarUrl: string;
  voice: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
  systemPrompt: string;
  tools: {
    enableCrm: boolean;
  };
  settings: {
    enableTranscription: boolean;
    speechSpeed: number; // e.g., 0.75, 1.0, 1.25, 1.5
    enableEmotionalSynthesis: boolean;
  };
  status: 'template' | 'draft' | 'published';
}
