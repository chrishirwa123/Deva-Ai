import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Palette, Mic, Volume2, Database, Cpu, Globe, Trash2, Check } from 'lucide-react';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { checkOllamaStatus } from '@/lib/ollama';
import type { AppSettings, OllamaStatus } from '@/lib/types';
import { accentColors } from '@/lib/theme';
import { SectionLoader, StatusDot } from './ui';

export function SettingsPage() {
  const { settings, saveSettings, refreshOllamaStatus, ollamaStatus } = useApp();
  const [local, setLocal] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<OllamaStatus | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setLocal(settings);
    if ('speechSynthesis' in window) {
      setVoices(window.speechSynthesis.getVoices());
      window.speechSynthesis.onvoiceschanged = () => setVoices(window.speechSynthesis.getVoices());
    }
  }, [settings]);

  async function save() {
    if (!local) return;
    setSaving(true);
    await saveSettings(local);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    refreshOllamaStatus();
  }

  async function testConnection() {
    if (!local) return;
    setTestingConnection(true);
    const result = await checkOllamaStatus(local.ollama_url);
    setTestResult(result);
    setTestingConnection(false);
  }

  async function exportAllData() {
    const [convs, mems, docs] = await Promise.all([
      supabase.from('conversations').select('*'),
      supabase.from('memories').select('*'),
      supabase.from('knowledge_documents').select('*'),
    ]);
    const data = {
      conversations: convs.data,
      memories: mems.data,
      knowledge_documents: docs.data,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deva-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearChatHistory() {
    if (!confirm('Delete all conversations and messages? This cannot be undone.')) return;
    await supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    alert('Chat history cleared.');
  }

  async function clearKnowledge() {
    if (!confirm('Delete all knowledge documents? This cannot be undone.')) return;
    await supabase.from('knowledge_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    alert('Knowledge library cleared.');
  }

  async function resetAll() {
    if (!confirm('Reset ALL application data? This will delete conversations, memories, and knowledge. This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? All your data will be permanently lost.')) return;
    await supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('memories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('knowledge_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('research_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    alert('All data has been reset.');
  }

  if (!local) return <SectionLoader />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Settings</h1>
              <p className="text-xs text-[var(--text-muted)]">Configure Deva AI</p>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary text-xs py-2 px-4">
            <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* AI Settings */}
        <Section icon={Cpu} title="AI Settings">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Ollama URL</label>
              <div className="flex gap-2">
                <input
                  value={local.ollama_url}
                  onChange={(e) => setLocal({ ...local, ollama_url: e.target.value })}
                  className="input-base flex-1"
                  placeholder="http://127.0.0.1:11434"
                />
                <button onClick={testConnection} disabled={testingConnection} className="btn-secondary text-sm whitespace-nowrap">
                  <RefreshCw size={14} className={testingConnection ? 'animate-spin' : ''} /> Test
                </button>
              </div>
              {testResult && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <StatusDot connected={testResult.connected} />
                  <span className={testResult.connected ? 'text-emerald-400' : 'text-red-400'}>
                    {testResult.connected ? `Connected — ${testResult.models.length} models available` : testResult.error ?? 'Connection failed'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Model</label>
              <select
                value={local.model}
                onChange={(e) => setLocal({ ...local, model: e.target.value })}
                className="input-base"
              >
                {ollamaStatus.models.length > 0 ? (
                  ollamaStatus.models.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))
                ) : (
                  <option value={local.model}>{local.model}</option>
                )}
                {!ollamaStatus.models.find((m) => m.name === local.model) && ollamaStatus.models.length > 0 && (
                  <option value={local.model}>{local.model} (not found)</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Temperature: {local.temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={local.temperature}
                  onChange={(e) => setLocal({ ...local, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Max Tokens: {local.max_tokens}</label>
                <input
                  type="range"
                  min="256"
                  max="8192"
                  step="256"
                  value={local.max_tokens}
                  onChange={(e) => setLocal({ ...local, max_tokens: parseInt(e.target.value) })}
                  className="w-full accent-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Custom System Prompt (added to Deva's identity)</label>
              <textarea
                value={local.system_prompt}
                onChange={(e) => setLocal({ ...local, system_prompt: e.target.value })}
                placeholder="Additional instructions for Deva..."
                className="input-base min-h-[80px] resize-none text-sm"
              />
            </div>
          </div>
        </Section>

        {/* Personalization */}
        <Section icon={Palette} title="Personalization">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">AI Display Name</label>
              <input
                value={local.ai_display_name}
                onChange={(e) => setLocal({ ...local, ai_display_name: e.target.value })}
                className="input-base"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-2 block">Accent Color</label>
              <div className="flex gap-3">
                {Object.entries(accentColors).map(([name, colors]) => (
                  <button
                    key={name}
                    onClick={() => setLocal({ ...local, accent_color: name })}
                    className={`w-10 h-10 rounded-lg transition-all ${local.accent_color === name ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-panel)]' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, boxShadow: local.accent_color === name ? `0 0 0 2px ${colors.primary}` : 'none' }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Animation Intensity</label>
              <select
                value={local.animation_intensity}
                onChange={(e) => setLocal({ ...local, animation_intensity: e.target.value })}
                className="input-base"
              >
                <option value="normal">Normal</option>
                <option value="reduced">Reduced</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Voice */}
        <Section icon={Mic} title="Voice & Speech">
          <div className="space-y-4">
            <Toggle
              label="Voice Input"
              description="Enable microphone for speech-to-text"
              value={local.voice_input_enabled}
              onChange={(v) => setLocal({ ...local, voice_input_enabled: v })}
            />

            <Toggle
              label="Speech Output"
              description="Read Deva's responses aloud"
              value={local.speech_output_enabled}
              onChange={(v) => setLocal({ ...local, speech_output_enabled: v })}
            />

            {local.speech_output_enabled && voices.length > 0 && (
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Voice</label>
                <select
                  value={local.voice_uri}
                  onChange={(e) => setLocal({ ...local, voice_uri: e.target.value })}
                  className="input-base"
                >
                  <option value="">Default</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Speech Rate: {local.speech_rate}x</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={local.speech_rate}
                onChange={(e) => setLocal({ ...local, speech_rate: parseFloat(e.target.value) })}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>
          </div>
        </Section>

        {/* Research */}
        <Section icon={Globe} title="Research">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Search Provider</label>
              <select
                value={local.search_provider}
                onChange={(e) => setLocal({ ...local, search_provider: e.target.value })}
                className="input-base"
              >
                <option value="duckduckgo">DuckDuckGo (no API key needed)</option>
                <option value="tavily">Tavily API</option>
              </select>
            </div>
            {local.search_provider === 'tavily' && (
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Tavily API Key</label>
                <input
                  type="password"
                  value={local.search_api_key}
                  onChange={(e) => setLocal({ ...local, search_api_key: e.target.value })}
                  placeholder="tvly-..."
                  className="input-base"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Get a key at tavily.com</p>
              </div>
            )}
          </div>
        </Section>

        {/* Data & Privacy */}
        <Section icon={Database} title="Data & Privacy">
          <div className="space-y-3">
            <button onClick={exportAllData} className="btn-secondary text-sm w-full justify-start">
              <Database size={16} /> Export All Data
            </button>
            <button onClick={clearChatHistory} className="btn-secondary text-sm w-full justify-start text-amber-400 border-amber-500/20 hover:bg-amber-500/10">
              <Trash2 size={16} /> Clear Chat History
            </button>
            <button onClick={clearKnowledge} className="btn-secondary text-sm w-full justify-start text-amber-400 border-amber-500/20 hover:bg-amber-500/10">
              <Trash2 size={16} /> Clear Knowledge Library
            </button>
            <button onClick={resetAll} className="btn-secondary text-sm w-full justify-start text-red-400 border-red-500/20 hover:bg-red-500/10">
              <Trash2 size={16} /> Reset All Application Data
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5 mb-4 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-[var(--accent-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
