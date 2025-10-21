
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { QueueItem, TranscriptMessage, AssistantTab, ConnectionStatus } from './types';
import { GeminiLiveService } from './services/geminiService';
import { CrmService } from './services/crmService';
import Login from './Login';

const EBURON_ICON_URL = "https://eburon-vibe.vercel.app/eburon-icon.png";

const MOCK_QUEUE: QueueItem[] = [
  { id: 'Q-1027', callerName: 'Sanchez, Elena', priority: 'High', waitTime: 23 },
  { id: 'Q-1028', callerName: 'Tan, Miguel', priority: 'Normal', waitTime: 9 },
];

// --- Sub-components ---

const Header: React.FC<{ status: ConnectionStatus; agentName: string }> = ({ status, agentName }) => {
  const statusMap = {
    disconnected: { color: 'var(--bad)', text: 'Disconnected' },
    connecting: { color: 'var(--warn)', text: 'Connecting...' },
    live: { color: 'var(--good)', text: 'Live' },
    error: { color: 'var(--bad)', text: 'Error' },
  };
  const currentStatus = statusMap[status];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <img src={EBURON_ICON_URL} alt="Eburon" className="w-7 h-7 rounded" />
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide">Eburon CSR Studio</span>
          <span className="badge hidden sm:inline-block">Powered by Gemini Live</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium capitalize">{agentName}</div>
            <div className="text-xs text-[var(--muted)]">Active Agent</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Status:</span>
            <span style={{ backgroundColor: currentStatus.color }} className="w-2 h-2 rounded-full inline-block"></span>
            <span className="text-xs text-[var(--muted)]">{currentStatus.text}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

const QueuePanel: React.FC<{ onAnswerCall: (item: QueueItem) => void; activeCall: QueueItem | null }> = ({ onAnswerCall, activeCall }) => (
  <section className="card shadow-soft p-3 md:sticky md:top-[64px] md:h-[calc(100dvh-88px)] md:overflow-auto scroll-slim">
    <h2 className="text-sm font-semibold mb-3">Queue</h2>
    <div className="space-y-2">
      {MOCK_QUEUE.map(item => (
        <div key={item.id} className="p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accentA)]/40 transition">
          <div className="flex justify-between text-xs text-[var(--muted)]">
            <span>{item.id}</span><span>waiting 00:{item.waitTime.toString().padStart(2, '0')}</span>
          </div>
          <div className="mt-1 flex justify-between items-center">
            <div>
              <div className="font-medium">{item.callerName}</div>
              <div className="text-xs text-[var(--muted)]">Priority: <span className={item.priority === 'High' ? 'text-[var(--warn)]' : ''}>{item.priority}</span></div>
            </div>
            <button disabled={!!activeCall} onClick={() => onAnswerCall(item)} className="btn btn-cta text-sm">Answer</button>
          </div>
        </div>
      ))}
    </div>
    <h2 className="text-sm font-semibold mt-5 mb-2">Caller Card</h2>
    <div className="p-3 rounded-lg border border-[var(--border)] min-h-[120px]">
      {activeCall ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <img src={EBURON_ICON_URL} className="w-8 h-8 rounded" alt="Caller" />
            <div>
              <div className="text-sm font-semibold">{activeCall.callerName}</div>
              <div className="text-xs text-[var(--muted)]">Segment: {activeCall.segment} &bull; Locale: {activeCall.locale}</div>
            </div>
          </div>
          <div>
              <div className="text-xs text-[var(--muted)]">
                  Intent: {activeCall.intent} &bull; Sentiment: <span className={activeCall.sentiment === 'Negative' ? 'text-[var(--bad)]' : 'text-[var(--good)]'}>{activeCall.sentiment}</span>
              </div>
          </div>
           {activeCall.interactionHistory && activeCall.interactionHistory.length > 0 && (
             <div>
                <h3 className="text-xs font-semibold text-[var(--muted)] mb-1">Recent Interactions</h3>
                <ul className="text-xs space-y-1 text-[var(--muted)] pl-2 border-l border-[var(--border)]">
                    {activeCall.interactionHistory.slice(0, 2).map((item, index) => (
                        <li key={index}><strong>{item.date}:</strong> {item.summary}</li>
                    ))}
                </ul>
             </div>
           )}
        </div>
      ) : <div className="text-xs text-[var(--muted)]">No active caller</div>}
    </div>
  </section>
);


const ActiveCallPanel: React.FC<{
  status: ConnectionStatus;
  transcript: TranscriptMessage[];
  onEndCall: () => void;
  onSummarize: () => void;
}> = ({ status, transcript, onEndCall, onSummarize }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <section className="card shadow-soft p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Active Call</h2>
        <div className="flex items-center gap-2">
          <span className="badge">Diarization: on</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className={`orb ${status === 'live' ? 'orb-live' : ''}`} aria-label="voice-visualizer"></div>
        <div className="text-xs text-[var(--muted)]">
          <div>Real-time stream via <span className="text-[var(--accentA)]">Eburon Voice Core</span></div>
          <div>ASR ↔ LLM ↔ TTS: bi-directional</div>
        </div>
      </div>
      <div className="mt-3 h-64 overflow-auto scroll-slim p-2 rounded-lg border border-[var(--border)] bg-black/20">
        {transcript.length === 0 ? <div className="text-xs text-center text-[var(--muted)] pt-4">Transcript appears here…</div> :
          transcript.map((msg, index) => (
            <div key={index} className="mb-2">
              <div className={`text-[10px] uppercase tracking-wide ${msg.isCoach ? 'text-[var(--accentB)]' : 'text-[var(--muted)]'}`}>{msg.speaker}</div>
              <div className="text-sm leading-5 whitespace-pre-wrap">{msg.text}</div>
            </div>
          ))
        }
        <div ref={transcriptEndRef} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button disabled className="btn">Hold</button>
        <button disabled className="btn">Mute</button>
        <button disabled className="btn">Transfer</button>
        <button onClick={onSummarize} disabled={status !== 'live' && transcript.length === 0} className="btn">Summarize</button>
        <button disabled className="btn">Translate</button>
        <button onClick={onEndCall} disabled={status === 'disconnected'} className="btn bg-[#1a1913] border-[#3d2f12]">End Call</button>
      </div>
    </section>
  );
};

const AssistantPanel: React.FC<{ 
  activeTab: AssistantTab; 
  setActiveTab: (tab: AssistantTab) => void;
  summary: string;
}> = ({ activeTab, setActiveTab, summary }) => (
  <section className="card shadow-soft p-3 md:sticky md:top-[64px] md:h-[calc(100dvh-88px)] md:overflow-auto scroll-slim">
     <nav className="flex gap-4 text-sm">
      {(['assist', 'translate', 'policies', 'summary'] as AssistantTab[]).map(tab => (
        <button key={tab} onClick={() => setActiveTab(tab)}
          className={`pb-2 capitalize ${activeTab === tab ? 'tab-active' : 'text-[var(--muted)]'}`}>
          {tab}
        </button>
      ))}
    </nav>
    <div className="mt-2 border-b border-[var(--border)]"></div>

    <div className={`${activeTab === 'assist' ? 'block' : 'hidden'} mt-3 space-y-2`}>
        <div className="p-3 rounded-lg border border-[var(--border)]">
            <div className="text-xs text-[var(--muted)] mb-1">Tone Coach</div>
            <div className="text-sm">Try: “Acknowledge delay, offer rebooking options, confirm fees upfront.”</div>
        </div>
        <div className="p-3 rounded-lg border border-[var(--border)]">
            <div className="text-xs text-[var(--muted)] mb-1">Suggested Reply</div>
            <div className="text-sm">Thanks for your patience. I’m checking the next available flight and will read back exact options and costs.</div>
        </div>
    </div>
    
    <div className={`${activeTab === 'summary' ? 'block' : 'hidden'} mt-3 space-y-2`}>
        <div className="p-3 rounded-lg border border-[var(--border)]">
            <div className="text-xs text-[var(--muted)] mb-1">Auto Summary</div>
            <div className="text-sm whitespace-pre-wrap">{summary || 'Will appear after summarizing.'}</div>
        </div>
    </div>
  </section>
);

// --- Main App Component ---

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [activeCall, setActiveCall] = useState<QueueItem | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [activeTab, setActiveTab] = useState<AssistantTab>('assist');
  const [summary, setSummary] = useState('');
  
  const geminiService = useRef<GeminiLiveService | null>(null);

  const handleLogin = (username: string) => {
    setAgentName(username.split('@')[0]);
    setIsAuthenticated(true);
  };

  const handleNewMessage = useCallback((message: TranscriptMessage) => {
    setTranscript(prev => [...prev, message]);
  }, []);

  const handleStatusChange = useCallback((newStatus: 'live' | 'error' | 'disconnected') => {
    setStatus(newStatus);
    if(newStatus === 'disconnected' || newStatus === 'error') {
      setActiveCall(null);
    }
  }, []);

  const handleAnswerCall = useCallback(async (item: QueueItem) => {
    if (activeCall || status !== 'disconnected') return;

    setStatus('connecting');
    setTranscript([]);
    setSummary('');

    const crmData = await CrmService.getCustomerDetails(item.callerName);
    const fullCallDetails = { ...item, ...crmData };
    setActiveCall(fullCallDetails);

    try {
      geminiService.current = new GeminiLiveService();
      await geminiService.current.connect(handleNewMessage, handleStatusChange);
      handleNewMessage({ speaker: 'System', text: `Call with ${item.callerName} connected.`});
    } catch (err) {
      console.error("Failed to start call:", err);
      handleNewMessage({ speaker: 'System', text: "Could not connect to call. Please check microphone permissions and API key." });
      setStatus('error');
      setActiveCall(null);
    }
  }, [activeCall, status, handleNewMessage, handleStatusChange]);

  const handleEndCall = useCallback(async () => {
    if (geminiService.current) {
      await geminiService.current.disconnect();
    }
    handleNewMessage({ speaker: 'System', text: 'Call ended.'});
    setStatus('disconnected');
    setActiveCall(null);
    if (summary) setActiveTab('summary'); // Only switch to summary if it exists
  }, [handleNewMessage, summary]);
  
  const handleSummarize = useCallback(async () => {
    if (!geminiService.current && transcript.length === 0) return;
    
    const fullTranscript = transcript
      .filter(t => t.speaker === 'Caller' || t.speaker === 'Agent')
      .map(t => `${t.speaker}: ${t.text}`).join('\n');

    if (!fullTranscript) {
      handleNewMessage({ speaker: 'System', text: 'No conversation to summarize.'});
      return;
    }

    handleNewMessage({ speaker: 'System', text: 'Generating summary...'});
    
    // Ensure geminiService is initialized for summarization even if call is disconnected
    const service = geminiService.current || new GeminiLiveService();
    if (!geminiService.current) geminiService.current = service;

    const generatedSummary = await service.summarize(fullTranscript);
    setSummary(generatedSummary);
    setActiveTab('summary');
    handleNewMessage({ speaker: 'System', text: 'Summary complete.'});
  }, [transcript, handleNewMessage]);

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <Header status={status} agentName={agentName} />
      <main className="mx-auto max-w-7xl px-4 py-4 glow">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="md:col-span-1 lg:col-span-1">
            <QueuePanel onAnswerCall={handleAnswerCall} activeCall={activeCall} />
          </div>
          
          <div className="md:col-span-2 lg:col-span-2">
            <ActiveCallPanel status={status} transcript={transcript} onEndCall={handleEndCall} onSummarize={handleSummarize} />
          </div>

          <div className="md:col-span-3 lg:col-span-1">
             <AssistantPanel activeTab={activeTab} setActiveTab={setActiveTab} summary={summary} />
          </div>
        </div>
      </main>
    </>
  );
}
