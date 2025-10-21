
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { QueueItem, TranscriptMessage, AssistantTab, ConnectionStatus, AgentPersona } from './types';
import { GeminiLiveService, decode, decodeAudioData } from './services/geminiService';
import { CrmService } from './services/crmService';

const EBURON_ICON_URL = "https://eburon-vibe.vercel.app/eburon-icon.png";

const MOCK_QUEUE: QueueItem[] = [
  { id: 'Q-1027', callerName: 'Sanchez, Elena', priority: 'High', waitTime: 23 },
  { id: 'Q-1028', callerName: 'Tan, Miguel', priority: 'Normal', waitTime: 9 },
];

const MOCK_PERSONAS: AgentPersona[] = [
    {
        id: 'template-01',
        name: 'Alex',
        avatarUrl: EBURON_ICON_URL,
        voice: 'Zephyr',
        systemPrompt: 'You are Alex, a friendly and efficient customer support agent for Eburon Airlines. You are helpful and always aim to solve the customer\'s problem on the first call. You are empathetic but concise.',
        tools: { enableCrm: true },
        settings: { enableTranscription: true, speechSpeed: 1.0, enableEmotionalSynthesis: true },
        status: 'template',
    },
    {
        id: 'template-02',
        name: 'Sam',
        avatarUrl: EBURON_ICON_URL,
        voice: 'Puck',
        systemPrompt: 'You are Sam, a senior support specialist for Eburon Airlines. You are formal, direct, and an expert in company policy. You handle escalations with authority and precision.',
        tools: { enableCrm: true },
        settings: { enableTranscription: true, speechSpeed: 1.0, enableEmotionalSynthesis: false },
        status: 'template',
    }
];

const GEMINI_VOICES: AgentPersona['voice'][] = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];


// --- Icon Components ---
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const BackIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;


// --- Login Component ---
const Login: React.FC<{ onLogin: (username: string) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.'); return;
    }
    setError(''); setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(username);
    }, 500);
  };

  return (
    <div className="flex items-center justify-center min-h-dvh glow">
      <div className="w-full max-w-sm p-8 space-y-6 card shadow-soft">
        <div className="flex flex-col items-center space-y-2">
          <img src={EBURON_ICON_URL} alt="Eburon" className="w-12 h-12 rounded-lg" />
          <h1 className="text-xl font-semibold tracking-wide text-center">Eburon CSR Studio</h1>
          <p className="text-sm text-[var(--muted)]">Agent Portal Login</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium text-[var(--muted)]">Agent Email</label>
            <input id="username" type="email" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]" placeholder="agent@eburon.com" />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-[var(--muted)]">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]" placeholder="••••••••" />
          </div>
          {error && <p className="text-xs text-[var(--bad)] text-center">{error}</p>}
          <div>
            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--accentA)]/20 hover:bg-[var(--accentA)]/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card)] focus:ring-[var(--accentA)] btn btn-cta">
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
         <p className="text-xs text-[var(--muted)] text-center">SSO & MFA options available in enterprise plans.</p>
      </div>
    </div>
  );
};

// --- Agent Builder Components ---

const AgentEditor: React.FC<{
    persona: AgentPersona;
    onBack: () => void;
    onSave: (persona: AgentPersona) => void;
}> = ({ persona, onBack, onSave }) => {
    const [editedPersona, setEditedPersona] = useState(persona);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleFieldChange = (field: keyof AgentPersona, value: any) => {
        setEditedPersona(prev => ({ ...prev, [field]: value }));
    };

    const handleSettingsChange = (field: keyof AgentPersona['settings'], value: any) => {
        setEditedPersona(prev => ({ ...prev, settings: { ...prev.settings, [field]: value } }));
    };

    const handleAvatarUpload = () => avatarInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                handleFieldChange('avatarUrl', event.target?.result as string);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handlePublish = () => {
        onSave({ ...editedPersona, status: 'published' });
    };
    
    const handleSaveDraft = () => {
        onSave({ ...editedPersona, status: 'draft' });
    };

    return (
        <div className="p-4 md:p-6">
            <button onClick={onBack} className="btn mb-4 inline-flex items-center gap-2 text-sm"><BackIcon/> Back to Agents</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <h3 className="text-lg font-semibold">Persona</h3>
                    <img src={editedPersona.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover mx-auto" />
                    <input type="file" ref={avatarInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <button onClick={handleAvatarUpload} className="btn w-full">Upload Avatar</button>
                </div>
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-[var(--muted)]">Agent Name</label>
                        <input type="text" value={editedPersona.name} onChange={e => handleFieldChange('name', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-[var(--muted)]">Voice</label>
                        <select value={editedPersona.voice} onChange={e => handleFieldChange('voice', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]">
                           {GEMINI_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-[var(--muted)]">Role and Call Flow (System Prompt)</label>
                        <textarea value={editedPersona.systemPrompt} onChange={e => handleFieldChange('systemPrompt', e.target.value)} rows={6} className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm scroll-slim focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]" />
                    </div>
                </div>
            </div>
            <div className="mt-6 border-t border-[var(--border)] pt-6">
                <h3 className="text-lg font-semibold mb-4">Tools & Settings</h3>
                <div className="space-y-3">
                     <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
                        <label htmlFor="crm-toggle" className="text-sm">Enable CRM Data</label>
                        <input type="checkbox" id="crm-toggle" className="toggle-checkbox" checked={editedPersona.tools.enableCrm} onChange={e => setEditedPersona(p => ({...p, tools: {...p.tools, enableCrm: e.target.checked}}))} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
                        <label htmlFor="transcription-toggle" className="text-sm">Enable Live Transcription</label>
                        <input type="checkbox" id="transcription-toggle" checked={editedPersona.settings.enableTranscription} onChange={e => handleSettingsChange('enableTranscription', e.target.checked)} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
                        <label htmlFor="emotion-toggle" className="text-sm">Enable Emotional Synthesis</label>
                        <input type="checkbox" id="emotion-toggle" checked={editedPersona.settings.enableEmotionalSynthesis} onChange={e => handleSettingsChange('enableEmotionalSynthesis', e.target.checked)} />
                    </div>
                    <div className="p-3 rounded-lg border border-[var(--border)]">
                        <label htmlFor="speed-control" className="text-sm">Speech Speed: {editedPersona.settings.speechSpeed}x</label>
                        <input id="speed-control" type="range" min="0.75" max="1.5" step="0.25" value={editedPersona.settings.speechSpeed} onChange={e => handleSettingsChange('speechSpeed', parseFloat(e.target.value))} className="w-full mt-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                </div>
            </div>
             <div className="mt-6 flex justify-end gap-3">
                <button onClick={handleSaveDraft} className="btn">Save Draft</button>
                <button onClick={handlePublish} className="btn btn-cta">Publish Agent</button>
            </div>
        </div>
    );
};


const AgentBuilder: React.FC<{
    onPersonaSelected: (persona: AgentPersona) => void;
    agentName: string;
}> = ({ onPersonaSelected, agentName }) => {
    const [personas, setPersonas] = useState<AgentPersona[]>([...MOCK_PERSONAS, {
        id: 'published-01',
        name: 'Clara',
        avatarUrl: EBURON_ICON_URL,
        voice: 'Kore',
        systemPrompt: 'You are Clara, a helpful agent.',
        tools: { enableCrm: true },
        settings: { enableTranscription: true, speechSpeed: 1.0, enableEmotionalSynthesis: true },
        status: 'published',
    }]);
    const [activeBuilderTab, setActiveBuilderTab] = useState<'myAgents' | 'templates'>('myAgents');
    const [editingPersona, setEditingPersona] = useState<AgentPersona | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    
    const geminiService = useRef(new GeminiLiveService());
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }, []);

    const handlePlayPreview = async (persona: AgentPersona) => {
        if (playingId === persona.id || !audioContextRef.current) return;
        setPlayingId(persona.id);
        const text = `Hello there, I am ${persona.name}, I'm Eburon's representative! Wanna try me?`;
        const base64Audio = await geminiService.current.generateSpeech(text, persona.voice);
        if (base64Audio) {
            try {
                const audioData = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.onended = () => setPlayingId(null);
                source.start();
            } catch (error) {
                console.error("Audio playback failed", error);
                setPlayingId(null);
            }
        } else {
            setPlayingId(null);
        }
    };
    
    const handleCustomize = (persona: AgentPersona) => {
        setEditingPersona({
            ...persona,
            id: `draft-${Date.now()}`,
            status: 'draft'
        });
    };

    const handleCreateNew = () => {
        const newAgent: AgentPersona = {
            id: `draft-${Date.now()}`,
            name: 'New Agent',
            avatarUrl: EBURON_ICON_URL,
            voice: 'Zephyr',
            systemPrompt: 'You are a helpful customer service agent.',
            tools: { enableCrm: true },
            settings: { enableTranscription: true, speechSpeed: 1.0, enableEmotionalSynthesis: false },
            status: 'draft',
        };
        setEditingPersona(newAgent);
    }
    
    const handleSavePersona = (personaToSave: AgentPersona) => {
        setPersonas(prev => {
            const existing = prev.find(p => p.id === personaToSave.id);
            if (existing) {
                return prev.map(p => p.id === personaToSave.id ? personaToSave : p);
            }
            return [...prev, personaToSave];
        });
        if (personaToSave.status === 'published') {
            setActiveBuilderTab('myAgents');
        }
        setEditingPersona(null);
    };

    if (editingPersona) {
        return <AgentEditor persona={editingPersona} onBack={() => setEditingPersona(null)} onSave={handleSavePersona} />;
    }

    const myAgents = personas.filter(p => p.status === 'published' || p.status === 'draft');
    const templates = personas.filter(p => p.status === 'template');

    const agentList = activeBuilderTab === 'myAgents' ? myAgents : templates;

    return (
        <div className="glow">
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
                <img src={EBURON_ICON_URL} alt="Eburon" className="w-7 h-7 rounded" />
                <span className="font-semibold tracking-wide">Agent Builder</span>
                <div className="ml-auto text-right">
                    <div className="text-sm font-medium capitalize">{agentName}</div>
                    <div className="text-xs text-[var(--muted)]">Active Agent</div>
                </div>
            </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex justify-between items-center mb-4">
                <nav className="flex gap-4 text-sm">
                    <button onClick={() => setActiveBuilderTab('myAgents')} className={`pb-2 ${activeBuilderTab === 'myAgents' ? 'tab-active' : 'text-[var(--muted)]'}`}>My Agents ({myAgents.length})</button>
                    <button onClick={() => setActiveBuilderTab('templates')} className={`pb-2 ${activeBuilderTab === 'templates' ? 'tab-active' : 'text-[var(--muted)]'}`}>Templates ({templates.length})</button>
                </nav>
                <button onClick={handleCreateNew} className="btn btn-cta inline-flex items-center gap-2 text-sm"><PlusIcon/> Create New Agent</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agentList.map(p => (
                    <div key={p.id} className="card p-4 flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                            <img src={p.avatarUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover" />
                            <div>
                                <h3 className="font-semibold">{p.name}</h3>
                                <p className="text-xs text-[var(--muted)] capitalize">{p.voice} Voice</p>
                            </div>
                            <button onClick={() => handlePlayPreview(p)} className="ml-auto btn" disabled={!!playingId}>
                                {playingId === p.id ? '...' : <PlayIcon />}
                            </button>
                        </div>
                        <div className="mt-4 text-xs text-[var(--muted)]">
                           {p.status === 'draft' && <span className="badge">Draft</span>}
                           {p.status === 'template' && <span className="badge">Template</span>}
                           {p.status === 'published' && <span className="badge bg-green-900/50 border-green-700 text-green-300">Published</span>}
                        </div>
                        <div className="mt-2 pt-3 border-t border-[var(--border)] flex gap-2">
                           {p.status === 'template' ? (
                              <button onClick={() => handleCustomize(p)} className="btn btn-cta w-full text-sm">Customize</button>
                           ) : (
                               <>
                                <button onClick={() => setEditingPersona(p)} className="btn w-1/2 text-sm">Edit</button>
                                <button onClick={() => onPersonaSelected(p)} disabled={p.status !== 'published'} className="btn btn-cta w-1/2 text-sm">Use Agent</button>
                               </>
                           )}
                        </div>
                    </div>
                ))}
            </div>
        </main>
        </div>
    );
};


// --- CSR Studio Components ---
const Header: React.FC<{ status: ConnectionStatus; agentName: string; onExit: () => void; }> = ({ status, agentName, onExit }) => {
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
        <button onClick={onExit} className="btn ml-auto text-sm inline-flex items-center gap-2"><SettingsIcon />Change Agent</button>
        <div className="flex items-center gap-4">
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

const QueuePanel: React.FC<{ onAnswerCall: (item: QueueItem) => void; activeCall: QueueItem | null; persona: AgentPersona | null }> = ({ onAnswerCall, activeCall, persona }) => (
  <section className="card shadow-soft p-3 md:sticky md:top-[64px] md:h-[calc(100dvh-88px)] md:overflow-auto scroll-slim">
     {persona && <div className="p-3 mb-3 rounded-lg border border-[var(--border)] flex items-center gap-3">
        <img src={persona.avatarUrl} className="w-10 h-10 rounded-full" alt="persona avatar"/>
        <div>
            <div className="text-xs text-[var(--muted)]">Active Persona</div>
            <div className="font-semibold">{persona.name}</div>
        </div>
     </div>}
    <h2 className="text-sm font-semibold mb-3">Queue</h2>
    <div className="space-y-2">
      {MOCK_QUEUE.map(item => (
        <div key={item.id} className="p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accentA)]/40 transition">
          <div className="flex justify-between text-xs text-[var(--muted)]"><span>{item.id}</span><span>waiting 00:{item.waitTime.toString().padStart(2, '0')}</span></div>
          <div className="mt-1 flex justify-between items-center">
            <div><div className="font-medium">{item.callerName}</div><div className="text-xs text-[var(--muted)]">Priority: <span className={item.priority === 'High' ? 'text-[var(--warn)]' : ''}>{item.priority}</span></div></div>
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
          <div><div className="text-xs text-[var(--muted)]">Intent: {activeCall.intent} &bull; Sentiment: <span className={activeCall.sentiment === 'Negative' ? 'text-[var(--bad)]' : 'text-[var(--good)]'}>{activeCall.sentiment}</span></div></div>
           {activeCall.interactionHistory && activeCall.interactionHistory.length > 0 && (<div><h3 className="text-xs font-semibold text-[var(--muted)] mb-1">Recent Interactions</h3><ul className="text-xs space-y-1 text-[var(--muted)] pl-2 border-l border-[var(--border)]">{activeCall.interactionHistory.slice(0, 2).map((item, index) => (<li key={index}><strong>{item.date}:</strong> {item.summary}</li>))}</ul></div>)}
        </div>
      ) : <div className="text-xs text-[var(--muted)]">No active caller</div>}
    </div>
  </section>
);


const ActiveCallPanel: React.FC<{ status: ConnectionStatus; transcript: TranscriptMessage[]; onEndCall: () => void; onSummarize: () => void; }> = ({ status, transcript, onEndCall, onSummarize }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  return (
    <section className="card shadow-soft p-3">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Active Call</h2><div className="flex items-center gap-2"><span className="badge">Diarization: on</span></div></div>
      <div className="mt-3 flex items-center gap-3">
        <div className={`orb ${status === 'live' ? 'orb-live' : ''}`} aria-label="voice-visualizer"></div>
        <div className="text-xs text-[var(--muted)]"><div>Real-time stream via <span className="text-[var(--accentA)]">Eburon Voice Core</span></div><div>ASR ↔ LLM ↔ TTS: bi-directional</div></div>
      </div>
      <div className="mt-3 h-64 overflow-auto scroll-slim p-2 rounded-lg border border-[var(--border)] bg-black/20">
        {transcript.length === 0 ? <div className="text-xs text-center text-[var(--muted)] pt-4">Transcript appears here…</div> :
          transcript.map((msg, index) => (<div key={index} className="mb-2"><div className={`text-[10px] uppercase tracking-wide ${msg.isCoach ? 'text-[var(--accentB)]' : 'text-[var(--muted)]'}`}>{msg.speaker}</div><div className="text-sm leading-5 whitespace-pre-wrap">{msg.text}</div></div>))
        }<div ref={transcriptEndRef} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button disabled className="btn">Hold</button><button disabled className="btn">Mute</button><button disabled className="btn">Transfer</button>
        <button onClick={onSummarize} disabled={status !== 'live' && transcript.length === 0} className="btn">Summarize</button>
        <button disabled className="btn">Translate</button><button onClick={onEndCall} disabled={status === 'disconnected'} className="btn bg-[#1a1913] border-[#3d2f12]">End Call</button>
      </div>
    </section>
  );
};

const AssistantPanel: React.FC<{ activeTab: AssistantTab; setActiveTab: (tab: AssistantTab) => void; summary: string; }> = ({ activeTab, setActiveTab, summary }) => (
  <section className="card shadow-soft p-3 md:sticky md:top-[64px] md:h-[calc(100dvh-88px)] md:overflow-auto scroll-slim">
     <nav className="flex gap-4 text-sm">{(['assist', 'translate', 'policies', 'summary'] as AssistantTab[]).map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 capitalize ${activeTab === tab ? 'tab-active' : 'text-[var(--muted)]'}`}>{tab}</button>))}</nav>
    <div className="mt-2 border-b border-[var(--border)]"></div>
    <div className={`${activeTab === 'assist' ? 'block' : 'hidden'} mt-3 space-y-2`}>
        <div className="p-3 rounded-lg border border-[var(--border)]"><div className="text-xs text-[var(--muted)] mb-1">Tone Coach</div><div className="text-sm">Try: “Acknowledge delay, offer rebooking options, confirm fees upfront.”</div></div>
        <div className="p-3 rounded-lg border border-[var(--border)]"><div className="text-xs text-[var(--muted)] mb-1">Suggested Reply</div><div className="text-sm">Thanks for your patience. I’m checking the next available flight and will read back exact options and costs.</div></div>
    </div>
    <div className={`${activeTab === 'summary' ? 'block' : 'hidden'} mt-3 space-y-2`}>
        <div className="p-3 rounded-lg border border-[var(--border)]"><div className="text-xs text-[var(--muted)] mb-1">Auto Summary</div><div className="text-sm whitespace-pre-wrap">{summary || 'Will appear after summarizing.'}</div></div>
    </div>
  </section>
);


const CSRStudio: React.FC<{ agentName: string; persona: AgentPersona, onExit: () => void }> = ({ agentName, persona, onExit }) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [activeCall, setActiveCall] = useState<QueueItem | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [activeTab, setActiveTab] = useState<AssistantTab>('assist');
  const [summary, setSummary] = useState('');
  
  const geminiService = useRef<GeminiLiveService | null>(null);

  const handleNewMessage = useCallback((message: TranscriptMessage) => { setTranscript(prev => [...prev, message]); }, []);
  const handleStatusChange = useCallback((newStatus: 'live' | 'error' | 'disconnected') => {
    setStatus(newStatus);
    if(newStatus === 'disconnected' || newStatus === 'error') { setActiveCall(null); }
  }, []);

  const handleAnswerCall = useCallback(async (item: QueueItem) => {
    if (activeCall || status !== 'disconnected') return;
    setStatus('connecting'); setTranscript([]); setSummary('');
    const crmData = await CrmService.getCustomerDetails(item.callerName);
    setActiveCall({ ...item, ...crmData });

    try {
      geminiService.current = new GeminiLiveService();
      await geminiService.current.connect(handleNewMessage, handleStatusChange, {
          systemPrompt: persona.systemPrompt,
          voice: persona.voice
      });
      handleNewMessage({ speaker: 'System', text: `Call with ${item.callerName} connected.`});
    } catch (err) {
      console.error("Failed to start call:", err);
      handleNewMessage({ speaker: 'System', text: "Could not connect to call. Please check microphone permissions and API key." });
      setStatus('error'); setActiveCall(null);
    }
  }, [activeCall, status, handleNewMessage, handleStatusChange, persona]);

  const handleEndCall = useCallback(async () => {
    if (geminiService.current) { await geminiService.current.disconnect(); }
    handleNewMessage({ speaker: 'System', text: 'Call ended.'});
    setStatus('disconnected'); setActiveCall(null);
    if (summary) setActiveTab('summary');
  }, [handleNewMessage, summary]);
  
  const handleSummarize = useCallback(async () => {
    if (!geminiService.current && transcript.length === 0) return;
    const fullTranscript = transcript.filter(t => t.speaker === 'Caller' || t.speaker === 'Agent').map(t => `${t.speaker}: ${t.text}`).join('\n');
    if (!fullTranscript) { handleNewMessage({ speaker: 'System', text: 'No conversation to summarize.'}); return; }
    handleNewMessage({ speaker: 'System', text: 'Generating summary...'});
    const service = geminiService.current || new GeminiLiveService();
    if (!geminiService.current) geminiService.current = service;
    const generatedSummary = await service.summarize(fullTranscript);
    setSummary(generatedSummary); setActiveTab('summary');
    handleNewMessage({ speaker: 'System', text: 'Summary complete.'});
  }, [transcript, handleNewMessage]);

  return (
    <>
      <Header status={status} agentName={agentName} onExit={onExit} />
      <main className="mx-auto max-w-7xl px-4 py-4 glow">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="md:col-span-1 lg:col-span-1"><QueuePanel onAnswerCall={handleAnswerCall} activeCall={activeCall} persona={persona} /></div>
          <div className="md:col-span-2 lg:col-span-2"><ActiveCallPanel status={status} transcript={transcript} onEndCall={handleEndCall} onSummarize={handleSummarize} /></div>
          <div className="md:col-span-3 lg:col-span-1"><AssistantPanel activeTab={activeTab} setActiveTab={setActiveTab} summary={summary} /></div>
        </div>
      </main>
    </>
  );
}


// --- Main App Component ---
export default function App() {
  const [view, setView] = useState<'login' | 'builder' | 'studio'>('login');
  const [agentName, setAgentName] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona | null>(null);

  const handleLogin = (username: string) => {
    setAgentName(username.split('@')[0]);
    setView('builder');
  };

  const handlePersonaSelected = (persona: AgentPersona) => {
    setSelectedPersona(persona);
    setView('studio');
  };
  
  const handleExitStudio = () => {
    setSelectedPersona(null);
    setView('builder');
  };

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (view === 'builder') {
    return <AgentBuilder onPersonaSelected={handlePersonaSelected} agentName={agentName} />;
  }
  
  if (view === 'studio' && selectedPersona) {
    return <CSRStudio agentName={agentName} persona={selectedPersona} onExit={handleExitStudio} />;
  }
  
  // Fallback to login
  return <Login onLogin={handleLogin} />;
}
