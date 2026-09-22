import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Square,
  RotateCcw,
  Copy,
  Trash2,
  Pencil,
  Check,
  X,
  Sparkles,
  Wifi,
  WifiOff,
  AlertCircle,
  Paperclip,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { streamChat, generateTitle, type ChatMessage } from '@/lib/ollama';
import { buildContextMessages, extractMemory, saveMemory } from '@/lib/context';
import type { Conversation, Message } from '@/lib/types';
import { MarkdownRenderer, CopyButton, EmptyState, LoadingSpinner, StatusDot } from './ui';

export function ChatPage() {
  const { settings, ollamaStatus, saveSettings } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [pendingMemory, setPendingMemory] = useState<string | null>(null);
  const [showMemoryPrompt, setShowMemoryPrompt] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  useEffect(() => {
    if (activeConv) loadMessages(activeConv.id);
    else setMessages([]);
  }, [activeConv?.id]);

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (data) {
      setConversations(data as Conversation[]);
      if (data.length > 0 && !activeConv) setActiveConv(data[0] as Conversation);
    }
  }

  async function loadMessages(convId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
  }

  async function createConversation(): Promise<Conversation> {
    const { data } = await supabase
      .from('conversations')
      .insert({ title: 'New Conversation', model: settings?.model ?? 'qwen3:1.7b' })
      .select('*')
      .maybeSingle();
    const conv = data as Conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveConv(conv);
    return conv;
  }

  const sendMessage = useCallback(async (text: string, convOverride?: Conversation) => {
    if (!text.trim() || streaming) return;
    setError(null);

    if (!ollamaStatus.connected) {
      setError('Cannot reach Ollama. Please ensure Ollama is running at ' + (settings?.ollama_url ?? 'http://127.0.0.1:11434'));
      return;
    }

    const conv = convOverride ?? activeConv ?? (await createConversation());

    // Save user message
    const { data: userMsg } = await supabase
      .from('messages')
      .insert({
        conversation_id: conv.id,
        role: 'user',
        content: text,
      })
      .select('*')
      .maybeSingle();

    if (userMsg) {
      setMessages((prev) => [...prev, userMsg as Message]);
    }

    setInput('');
    setStreaming(true);
    setStreamContent('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const contextMessages = await buildContextMessages(conv.id, text, settings);

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

      // Save assistant message
      const { data: assistantMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          role: 'assistant',
          content: fullResponse,
          model: settings?.model ?? 'qwen3:1.7b',
        })
        .select('*')
        .maybeSingle();

      if (assistantMsg) {
        setMessages((prev) => [...prev, assistantMsg as Message]);
      }
      setStreamContent('');

      // Generate title if first message
      if (messages.length === 0) {
        const title = await generateTitle(
          settings?.ollama_url ?? 'http://127.0.0.1:11434',
          settings?.model ?? 'qwen3:1.7b',
          text,
        );
        await supabase.from('conversations').update({ title }).eq('id', conv.id);
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, title } : c)));
        if (activeConv?.id === conv.id) setActiveConv((prev) => (prev ? { ...prev, title } : prev));
      }

      // Try to extract memory
      const memory = await extractMemory(
        settings?.ollama_url ?? 'http://127.0.0.1:11434',
        settings?.model ?? 'qwen3:1.7b',
        text,
        fullResponse,
      );
      if (memory) {
        setPendingMemory(memory);
        setShowMemoryPrompt(true);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Save partial response
        if (streamContent) {
          const { data: partial } = await supabase
            .from('messages')
            .insert({
              conversation_id: conv.id,
              role: 'assistant',
              content: streamContent + '\n\n*[Generation stopped]*',
              model: settings?.model ?? 'qwen3:1.7b',
            })
            .select('*')
            .maybeSingle();
          if (partial) setMessages((prev) => [...prev, partial as Message]);
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to generate response: ${msg}`);
      }
      setStreamContent('');
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [activeConv, streaming, ollamaStatus, settings, messages.length, streamContent]);

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function regenerate() {
    if (messages.length < 2 || streaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;

    // Remove last assistant message
    const lastAssistant = messages[messages.length - 1];
    if (lastAssistant?.role === 'assistant') {
      await supabase.from('messages').delete().eq('id', lastAssistant.id);
      setMessages((prev) => prev.slice(0, -1));
    }

    sendMessage(lastUser.content);
  }

  async function editAndResend(msgId: string, newContent: string) {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    // Delete all messages after this one
    const idx = messages.indexOf(msg);
    const toDelete = messages.slice(idx);
    for (const m of toDelete) {
      await supabase.from('messages').delete().eq('id', m.id);
    }
    setMessages((prev) => prev.slice(0, idx));

    setEditingMsgId(null);
    sendMessage(newContent);
  }

  async function deleteConversation() {
    if (!activeConv) return;
    await supabase.from('conversations').delete().eq('id', activeConv.id);
    setConversations((prev) => prev.filter((c) => c.id !== activeConv.id));
    setActiveConv(null);
    setMessages([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleMemorySave() {
    if (pendingMemory) {
      await saveMemory(pendingMemory);
      setShowMemoryPrompt(false);
      setPendingMemory(null);
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
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{activeConv?.title ?? 'New Conversation'}</h2>
            <p className="text-[10px] text-[var(--text-muted)]">{settings?.model ?? 'qwen3:1.7b'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot connected={ollamaStatus.connected} />
            <span className={ollamaStatus.connected ? 'text-emerald-400' : 'text-red-400'}>
              {ollamaStatus.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          {activeConv && (
            <button onClick={deleteConversation} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-white/5 transition-colors" title="Delete conversation">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {messages.length === 0 && !streaming ? (
          <EmptyState
            icon={<Sparkles size={28} />}
            title="Start a conversation with Deva AI"
            description="Ask anything, share your thoughts, or request help. Deva is connected to your local Ollama model and remembers your profile and saved memories."
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onEdit={(id) => { setEditingMsgId(id); setEditText(msg.content); }}
                onRegenerate={regenerate}
                isLast={msg.id === messages[messages.length - 1]?.id}
              />
            ))}
            {editingMsgId && (
              <div className="glass rounded-xl p-3 animate-scale-in">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="input-base text-sm min-h-[60px] resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setEditingMsgId(null)} className="btn-secondary text-xs py-1.5 px-3">
                    <X size={14} /> Cancel
                  </button>
                  <button onClick={() => editAndResend(editingMsgId, editText)} className="btn-primary text-xs py-1.5 px-3">
                    <Check size={14} /> Send
                  </button>
                </div>
              </div>
            )}
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
        )}
      </div>

      {/* Memory prompt */}
      {showMemoryPrompt && pendingMemory && (
        <div className="px-4 md:px-8 pb-2 max-w-3xl mx-auto w-full">
          <div className="glass rounded-xl p-3 border border-[var(--border-accent)] animate-fade-in-up">
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              <Sparkles size={12} className="inline mr-1 text-[var(--accent-primary)]" />
              Deva learned something new. Save this to memory?
            </p>
            <p className="text-sm text-[var(--text-primary)] mb-3">{pendingMemory}</p>
            <div className="flex gap-2">
              <button onClick={handleMemorySave} className="btn-primary text-xs py-1.5 px-3">
                <Check size={14} /> Save
              </button>
              <button onClick={() => { setShowMemoryPrompt(false); setPendingMemory(null); }} className="btn-secondary text-xs py-1.5 px-3">
                <X size={14} /> Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 md:px-8 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="glass-strong rounded-2xl border border-[var(--border-default)] focus-within:border-[var(--accent-primary)] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message to Deva AI..."
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-4 pt-3 pb-1 resize-none outline-none min-h-[44px] max-h-[200px]"
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 200) + 'px';
              }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-white/5 transition-colors" title="Attach document (coming soon)" disabled>
                  <Paperclip size={16} />
                </button>
                <button
                  onClick={() => saveSettings({ online_mode: !settings?.online_mode })}
                  className={`p-2 rounded-lg transition-colors ${settings?.online_mode ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                  title="Toggle online research mode"
                >
                  {settings?.online_mode ? <Wifi size={16} /> : <WifiOff size={16} />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {streaming ? (
                  <button onClick={stopGeneration} className="btn-secondary text-sm py-2 px-4">
                    <Square size={16} /> Stop
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim()}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    <Send size={16} /> Send
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
            Press Enter to send, Shift+Enter for new line. Deva runs locally via Ollama.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onEdit, onRegenerate, isLast }: {
  msg: Message;
  onEdit: (id: string) => void;
  onRegenerate: () => void;
  isLast: boolean;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`group flex gap-3 animate-fade-in-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isUser ? 'bg-[var(--bg-elevated)]' : 'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]'}`}>
        {isUser ? (
          <span className="text-xs font-bold text-[var(--text-secondary)]">You</span>
        ) : (
          <Sparkles size={16} className="text-white" />
        )}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div className={`glass rounded-2xl p-4 ${isUser ? 'rounded-tr-sm bg-[var(--bg-elevated)]' : 'rounded-tl-sm'}`}>
          {isUser ? (
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <MarkdownRenderer content={msg.content} />
          )}
        </div>
        <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : ''}`}>
          <CopyButton text={msg.content} />
          {isUser && (
            <button onClick={() => onEdit(msg.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all">
              <Pencil size={14} /> Edit
            </button>
          )}
          {!isUser && isLast && (
            <button onClick={onRegenerate} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all">
              <RotateCcw size={14} /> Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
