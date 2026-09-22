import { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Search, Pencil, Check, X, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/types';
import { EmptyState, SectionLoader } from './ui';

export function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');

  useEffect(() => {
    loadMemories();
  }, []);

  async function loadMemories() {
    setLoading(true);
    const { data } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false });
    setMemories((data ?? []) as Memory[]);
    setLoading(false);
  }

  async function addMemory() {
    if (!newContent.trim()) return;
    const { data } = await supabase
      .from('memories')
      .insert({ content: newContent, category: newCategory, source: 'manual', approved: true })
      .select('*')
      .maybeSingle();
    if (data) {
      setMemories((prev) => [data as Memory, ...prev]);
      setNewContent('');
      setNewCategory('general');
      setShowAdd(false);
    }
  }

  async function deleteMemory(id: string) {
    await supabase.from('memories').delete().eq('id', id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function updateMemory(id: string) {
    await supabase.from('memories').update({ content: editContent, category: editCategory }).eq('id', id);
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, content: editContent, category: editCategory } : m)));
    setEditingId(null);
  }

  async function exportMemories() {
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deva-memories.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearAllMemories() {
    if (!confirm('Delete all memories? This cannot be undone.')) return;
    await supabase.from('memories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setMemories([]);
  }

  const filtered = memories.filter((m) =>
    m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = [...new Set(memories.map((m) => m.category))];

  if (loading) return <SectionLoader />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Personal Memory</h1>
              <p className="text-xs text-[var(--text-muted)]">{memories.length} memories stored</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportMemories} className="btn-secondary text-xs py-2 px-3">Export</button>
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs py-2 px-3">
              <Plus size={14} /> Add Memory
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10"
          />
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="glass rounded-xl p-4 mb-4 animate-scale-in">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What should Deva remember?"
              className="input-base min-h-[80px] resize-none mb-3"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
                className="input-base flex-1"
              />
              <button onClick={addMemory} className="btn-primary text-sm">
                <Check size={16} /> Save
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Memories list */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Brain size={28} />}
            title="No memories yet"
            description="Add memories manually or let Deva extract them from conversations. Deva will use these to personalize responses."
            action={memories.length > 0 ? <button onClick={clearAllMemories} className="btn-secondary text-sm">Clear All</button> : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((mem) => (
              <div key={mem.id} className="glass rounded-xl p-4 group hover:border-[var(--border-accent)] transition-all animate-fade-in-up">
                {editingId === mem.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="input-base min-h-[60px] resize-none mb-2"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <input
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="input-base flex-1 text-sm"
                        placeholder="Category"
                      />
                      <button onClick={() => updateMemory(mem.id)} className="btn-primary text-xs py-1.5 px-3">
                        <Check size={14} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1.5 px-3">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-[var(--text-primary)] flex-1">{mem.content}</p>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => { setEditingId(mem.id); setEditContent(mem.content); setEditCategory(mem.category); }}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] rounded-md hover:bg-white/5"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteMemory(mem.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-md hover:bg-white/5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                        <Tag size={10} /> {mem.category}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(mem.created_at).toLocaleDateString()}
                      </span>
                      {mem.source !== 'manual' && (
                        <span className="text-[10px] text-[var(--text-muted)]">via {mem.source}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
            {memories.length > 0 && (
              <button onClick={clearAllMemories} className="text-xs text-red-400 hover:text-red-300 transition-colors mt-4 mx-auto block">
                Clear all memories
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
