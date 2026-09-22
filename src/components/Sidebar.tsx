import {
  MessageSquarePlus,
  Search,
  BookOpen,
  Brain,
  User,
  Settings,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  Trash2,
  Pencil,
  Check,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { Conversation, Page } from '@/lib/types';
import { StatusDot } from './ui';

interface NavItem {
  id: Page;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquarePlus },
  { id: 'assistant', label: 'Deva Assistant', icon: Sparkles },
  { id: 'research', label: 'Research', icon: Globe },
  { id: 'knowledge', label: 'Knowledge Library', icon: BookOpen },
  { id: 'memory', label: 'Personal Memory', icon: Brain },
  { id: 'profile', label: 'Owner Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ onNavigate, activePage }: { onNavigate: (p: Page) => void; activePage: Page }) {
  const { settings, ollamaStatus, sidebarOpen, toggleSidebar } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (data) setConversations(data as Conversation[]);
  }

  async function newChat() {
    const { data } = await supabase
      .from('conversations')
      .insert({ title: 'New Conversation', model: settings?.model ?? 'qwen3:1.7b' })
      .select('*')
      .maybeSingle();
    if (data) {
      setConversations((prev) => [data as Conversation, ...prev]);
      onNavigate('chat');
    }
  }

  async function deleteConversation(id: string) {
    await supabase.from('conversations').delete().eq('id', id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  async function renameConversation(id: string, title: string) {
    await supabase.from('conversations').update({ title }).eq('id', id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    setEditingId(null);
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (!sidebarOpen) {
    return (
      <div className="w-14 h-full glass-strong border-r border-[var(--border-subtle)] flex flex-col items-center py-4 gap-2 flex-shrink-0">
        <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[var(--text-secondary)]">
          <PanelLeftOpen size={20} />
        </button>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] my-2">
          <Sparkles size={16} className="text-white" />
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`p-2.5 rounded-lg transition-colors ${activePage === item.id ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
            title={item.label}
          >
            <item.icon size={18} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 h-full glass-strong border-r border-[var(--border-subtle)] flex flex-col flex-shrink-0 animate-slide-in-left">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center glow-sm">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)] text-sm leading-tight">Deva AI</h2>
              <p className="text-[10px] text-[var(--text-muted)]">Local-First Assistant</p>
            </div>
          </div>
          <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[var(--text-secondary)]">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <button onClick={newChat} className="btn-primary w-full justify-center text-sm py-2.5">
          <MessageSquarePlus size={16} /> New Chat
        </button>
      </div>

      {/* Navigation */}
      <div className="px-2 py-2 border-b border-[var(--border-subtle)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activePage === item.id ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-xs py-2"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">No conversations yet</p>
        ) : (
          filtered.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activePage === 'chat' ? 'bg-white/5' : 'hover:bg-white/5'}`}
              onClick={() => onNavigate('chat')}
            >
              {editingId === conv.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    ref={editRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameConversation(conv.id, editTitle);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="input-base text-xs py-1 px-2 flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={(e) => { e.stopPropagation(); renameConversation(conv.id, editTitle); }} className="text-emerald-400 hover:text-emerald-300">
                    <Check size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-red-400 hover:text-red-300">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">{conv.title}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title); }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer status */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Ollama</span>
          <div className="flex items-center gap-1.5">
            <StatusDot connected={ollamaStatus.connected} />
            <span className={ollamaStatus.connected ? 'text-emerald-400' : 'text-red-400'}>
              {ollamaStatus.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">Model</span>
          <span className="text-[var(--text-secondary)] truncate max-w-[140px]">{settings?.model ?? 'qwen3:1.7b'}</span>
        </div>
      </div>
    </div>
  );
}
