
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