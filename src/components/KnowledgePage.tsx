import { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Trash2, Search, FileText, Link2, Upload, Tag, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { KnowledgeDocument } from '@/lib/types';
import { EmptyState, SectionLoader } from './ui';

export function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  async function loadDocs() {
    setLoading(true);
    const { data } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false });
    setDocs((data ?? []) as KnowledgeDocument[]);
    setLoading(false);
  }

  async function addDoc() {
    if (!newTitle.trim() || !newContent.trim()) return;
    const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean);
    const { data } = await supabase
      .from('knowledge_documents')
      .insert({
        title: newTitle,
        content: newContent,
        source_type: newUrl ? 'web' : 'manual',
        source_url: newUrl || null,
        tags,
        indexed: true,
      })
      .select('*')
      .maybeSingle();
    if (data) {
      setDocs((prev) => [data as KnowledgeDocument, ...prev]);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      setNewUrl('');
      setShowAdd(false);
    }
  }

  async function deleteDoc(id: string) {
    await supabase.from('knowledge_documents').delete().eq('id', id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Max 5MB.`);
        continue;
      }

      const text = await file.text();
      const { data } = await supabase
        .from('knowledge_documents')
        .insert({
          title: file.name,
          content: text,
          source_type: 'file',
          tags: [file.name.split('.').pop() ?? 'file'],
          indexed: true,
        })
        .select('*')
        .maybeSingle();
      if (data) setDocs((prev) => [data as KnowledgeDocument, ...prev]);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function exportLibrary() {
    const blob = new Blob([JSON.stringify(docs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deva-knowledge.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearLibrary() {
    if (!confirm('Delete all knowledge documents? This cannot be undone.')) return;
    await supabase.from('knowledge_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setDocs([]);
  }

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.content.toLowerCase().includes(search.toLowerCase()) ||
    d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  if (loading) return <SectionLoader />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Knowledge Library</h1>
              <p className="text-xs text-[var(--text-muted)]">{docs.length} documents stored</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".txt,.md,.json,.csv" multiple onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-2 px-3">
              <Upload size={14} /> Upload
            </button>
            <button onClick={exportLibrary} className="btn-secondary text-xs py-2 px-3">Export</button>
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs py-2 px-3">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10"
          />
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="glass rounded-xl p-4 mb-4 animate-scale-in space-y-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Document title"
              className="input-base"
              autoFocus
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Source URL (optional)"
              className="input-base"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Document content..."
              className="input-base min-h-[120px] resize-none"
            />
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="input-base"
            />
            <div className="flex gap-2">
              <button onClick={addDoc} className="btn-primary text-sm">Save Document</button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Documents */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={28} />}
            title="No documents yet"
            description="Upload files, add notes, or save research findings. Deva will reference this knowledge during conversations."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="glass rounded-xl p-4 group hover:border-[var(--border-accent)] transition-all animate-fade-in-up cursor-pointer"
                onClick={() => setPreviewDoc(doc)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {doc.source_type === 'web' ? <Link2 size={16} className="text-[var(--accent-primary)] flex-shrink-0" /> : <FileText size={16} className="text-[var(--accent-primary)] flex-shrink-0" />}
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{doc.title}</h3>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 rounded-md transition-all flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{doc.content.slice(0, 150)}...</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {doc.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      <Tag size={9} /> {tag}
                    </span>
                  ))}
                  <span className="text-[10px] text-[var(--text-muted)] ml-auto">{doc.source_type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <button onClick={clearLibrary} className="text-xs text-red-400 hover:text-red-300 transition-colors mt-6 mx-auto block">
            Clear all documents
          </button>
        )}
      </div>

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewDoc(null)}>
          <div className="glass-strong rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md hover:bg-white/5">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previewDoc.source_url && (
                <a href={previewDoc.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent-primary)] underline mb-3 inline-block">
                  {previewDoc.source_url}
                </a>
              )}
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{previewDoc.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
