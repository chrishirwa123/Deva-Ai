import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Send,
  Square,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { streamChat, type ChatMessage } from '@/lib/ollama';
import { buildContextMessages } from '@/lib/context';
import type { Message } from '@/lib/types';
import { MarkdownRenderer, StatusDot } from './ui';

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export function AssistantPage() {
  const { settings, ollamaStatus } = useApp();
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  useEffect(() => {
    setVoiceEnabled(settings?.voice_input_enabled ?? false);
    setMuted(!(settings?.speech_output_enabled ?? false));
  }, [settings?.voice_input_enabled, settings?.speech_output_enabled]);

  // Create a conversation for the assistant page
  async function ensureConversation() {
    if (convId) return convId;
    const { data } = await supabase
      .from('conversations')
      .insert({ title: 'Deva Assistant Session', model: settings?.model ?? 'qwen3:1.7b' })
      .select('*')
      .maybeSingle();
    if (data) {
      setConvId(data.id);
      return data.id;
    }
    return null;
  }

  const speak = useCallback((text: string) => {
    if (muted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[*#`_~\[\]]/g, ''));
    utter.rate = settings?.speech_rate ?? 1.0;
    if (settings?.voice_uri) {
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find((vc) => vc.voiceURI === settings.voice_uri);
      if (v) utter.voice = v;
    }
    utter.onstart = () => setOrbState('speaking');
    utter.onend = () => setOrbState('idle');
    utter.onerror = () => setOrbState('idle');
    window.speechSynthesis.speak(utter);
  }, [muted, settings]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);

    if (!ollamaStatus.connected) {
      setError('Cannot reach Ollama. Ensure it is running at ' + (settings?.ollama_url ?? 'http://127.0.0.1:11434'));
      setOrbState('error');
      return;
    }

    const cId = await ensureConversation();
    if (!cId) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setStreaming(true);
    setOrbState('thinking');
    setStreamContent('');

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: cId,
      role: 'user',
      content: text,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const contextMessages = await buildContextMessages(cId, text, settings);
      let accumulated = '';

      const fullResponse = await streamChat(
        settings?.ollama_url ?? 'http://127.0.0.1:11434',
        settings?.model ?? 'qwen3:1.7b',
        contextMessages,
        { temperature: settings?.temperature ?? 0.7, max_tokens: settings?.max_tokens ?? 2048 },
        (token) => {
          accumulated += token;
          setStreamContent(accumulated);
        },
        controller.signal,
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamContent('');
      setStreaming(false);
      setOrbState('idle');

      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id: cId,
        role: 'assistant',
        content: fullResponse,
        model: settings?.model ?? 'qwen3:1.7b',
      });

      // Speak the response
      if (!muted) speak(fullResponse);
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed: ${msg}`);
        setOrbState('error');
      }
      setStreamContent('');
      setStreaming(false);
      setOrbState('idle');
    } finally {
      abortRef.current = null;
    }
  }, [streaming, ollamaStatus, settings, convId, muted, speak]);

  function stopAll() {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
    setStreaming(false);
    setStreamContent('');
    setOrbState('idle');
  }

  function toggleVoiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Chrome or Edge is required for speech recognition.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setOrbState('idle');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
      setOrbState('listening');
    };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
      if (event.results[0]?.isFinal) {
        setListening(false);
        setOrbState('idle');
        sendMessage(transcript);
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setOrbState('idle');
      setError('Voice recognition error. Make sure your browser supports it and microphone access is granted.');
    };
    recognition.onend = () => {
      setListening(false);
      if (orbState === 'listening') setOrbState('idle');
    };

    recognition.start();
  }

  function clearConversation() {
    setMessages([]);
    setError(null);
    setOrbState('idle');
    window.speechSynthesis?.cancel();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass-strong border-b border-[var(--border-subtle)] px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deva Assistant</h2>
            <p className="text-[10px] text-[var(--text-muted)]">{settings?.ai_display_name ?? 'Deva AI'} · {settings?.model ?? 'qwen3:1.7b'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot connected={ollamaStatus.connected} />
            <span className={ollamaStatus.connected ? 'text-emerald-400' : 'text-red-400'}>
              {ollamaStatus.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <button onClick={clearConversation} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-white/5 transition-colors" title="Clear conversation">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Orb and messages */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Orb */}
          <div className="flex flex-col items-center justify-center py-8">
            <DevaOrb state={orbState} />
            <p className="text-sm text-[var(--text-secondary)] mt-6 capitalize">
              {orbState === 'idle' && 'Ready to assist'}
              {orbState === 'listening' && 'Listening...'}
              {orbState === 'thinking' && 'Processing...'}
              {orbState === 'speaking' && 'Speaking...'}
              {orbState === 'error' && 'Connection error'}
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-4 mt-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${msg.role === 'user' ? 'bg-[var(--bg-elevated)]' : 'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]'}`}>
                  {msg.role === 'user' ? (
                    <span className="text-xs font-bold text-[var(--text-secondary)]">You</span>
                  ) : (
                    <Sparkles size={16} className="text-white" />
                  )}
                </div>
                <div className={`max-w-[85%] glass rounded-2xl p-4 ${msg.role === 'user' ? 'rounded-tr-sm bg-[var(--bg-elevated)]' : 'rounded-tl-sm'}`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex gap-3 animate-fade-in-up">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="flex-1 glass rounded-2xl rounded-tl-sm p-4">
                  {streamContent ? (
                    <MarkdownRenderer content={streamContent} />
                  ) : (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="glass rounded-xl p-4 border-l-4 border-red-500 flex items-start gap-3 animate-fade-in-up">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 md:px-8 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Voice controls */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              onClick={toggleVoiceInput}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'glass text-[var(--text-secondary)] hover:text-[var(--accent-primary)]'}`}
              title={listening ? 'Stop listening' : 'Start voice input'}
            >
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={() => setMuted(!muted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${muted ? 'glass text-[var(--text-muted)]' : 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'}`}
              title={muted ? 'Unmute speech' : 'Mute speech'}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            {streaming && (
              <button onClick={stopAll} className="w-12 h-12 rounded-full glass flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all" title="Stop">
                <Square size={18} />
              </button>
            )}
          </div>

          {/* Text input */}
          <div className="glass-strong rounded-2xl border border-[var(--border-default)] focus-within:border-[var(--accent-primary)] transition-colors">
            <div className="flex items-end gap-2 px-4 py-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Talk to Deva or type a message..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[24px] max-h-[120px]"
                rows={1}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                className="btn-primary text-sm py-2 px-4 flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
            Voice input uses your browser's speech recognition. Speech output uses text-to-speech.
          </p>
        </div>
      </div>
    </div>
  );
}

function DevaOrb({ state }: { state: OrbState }) {
  const stateColors: Record<OrbState, string> = {
    idle: 'var(--accent-primary)',
    listening: '#06b6d4',
    thinking: '#f59e0b',
    speaking: '#10b981',
    error: '#ef4444',
  };
  const color = stateColors[state];

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-30 transition-colors duration-500"
        style={{ background: color }}
      />

      {/* Rotating rings */}
      <div
        className="absolute inset-0 rounded-full border-2 opacity-40"
        style={{ borderColor: color, animation: 'orbRing 8s linear infinite' }}
      />
      <div
        className="absolute inset-4 rounded-full border opacity-30"
        style={{ borderColor: color, animation: 'orbRing 6s linear infinite reverse' }}
      />
      <div
        className="absolute inset-8 rounded-full border opacity-20"
        style={{ borderColor: color, animation: 'orbRing 4s linear infinite' }}
      />

      {/* Core */}
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          background: `radial-gradient(circle, ${color}40, ${color}10, transparent)`,
          animation: state === 'idle' ? 'orbPulse 3s ease-in-out infinite' : 'orbPulse 1.5s ease-in-out infinite',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, ${color}60, ${color}20)`,
            boxShadow: `0 0 40px ${color}80`,
          }}
        >
          <Sparkles size={28} className="text-white/90" />
        </div>
      </div>

      {/* Particles for active states */}
      {(state === 'listening' || state === 'thinking' || state === 'speaking') && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: color,
                animation: `orbRing ${2 + i * 0.3}s linear infinite`,
                transform: `rotate(${i * 60}deg) translateY(-90px)`,
                opacity: 0.6,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
