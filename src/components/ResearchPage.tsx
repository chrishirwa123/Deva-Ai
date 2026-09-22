import { useState, useEffect } from 'react';
import { Globe, Search, Save, ExternalLink, Clock, Check, X, AlertCircle, BookPlus } from 'lucide-react';
import { useApp } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { ResearchTask, ResearchSource } from '@/lib/types';
import { EmptyState, SectionLoader, StatusDot } from './ui';

export function ResearchPage() {
  const { settings, ollamaStatus } = useApp();
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadTasks();
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler); };
  }, []);

  async function loadTasks() {
    setLoading(true);
    const { data } = await supabase
      .from('research_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    setTasks((data ?? []) as ResearchTask[]);
    setLoading(false);
  }

  async function startResearch() {
    if (!query.trim() || researching) return;

    if (!online) {
      setError('No internet connection. Research requires online access.');
      return;
    }

    setError(null);
    setResearching(true);

    // Create task record
    const { data: task } = await supabase
      .from('research_tasks')
      .insert({ query, status: 'searching' })
      .select('*')
      .maybeSingle();

    if (!task) {
      setError('Failed to create research task.');
      setResearching(false);
      return;
    }

    const taskId = task.id;
    const sources: ResearchSource[] = [];

    try {
      // Use DuckDuckGo HTML search (no API key required)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: { 'Accept': 'text/html' },
      });

      if (!res.ok) throw new Error('Search request failed');

      const html = await res.text();

      // Parse search results
      const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)<\/a>/g;
      const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/g;
      let match;
      let count = 0;
      while ((match = linkRegex.exec(html)) !== null && count < 8) {
        const rawUrl = match[1];
        const titleHtml = match[2].replace(/<[^>]+>/g, '');
        const snippetMatch = snippetRegex.exec(html);
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // DuckDuckGo redirects through their own URL
        let url = rawUrl;
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }

        if (url && url.startsWith('http')) {
          sources.push({ title: titleHtml, url, snippet });
          count++;
        }
      }

      if (sources.length === 0) {
        throw new Error('No results found. Try a different query.');
      }

      await supabase.from('research_tasks').update({ status: 'fetching', sources: sources as any }).eq('id', taskId);

      // Try to fetch top 3 sources for content
      const summaries: string[] = [];
      for (let i = 0; i < Math.min(3, sources.length); i++) {
        try {
          const pageRes = await fetch(sources[i].url, { signal: AbortSignal.timeout(10000) });
          if (pageRes.ok) {
            const pageHtml = await pageRes.text();
            const text = pageHtml
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 2000);
            if (text) summaries.push(`### ${sources[i].title}\n${text}`);
          }
        } catch {
          // skip failed fetches
        }
      }

      await supabase.from('research_tasks').update({ status: 'summarizing' }).eq('id', taskId);

      // Generate summary with Ollama if available
      let summary = '';
      if (ollamaStatus.connected && summaries.length > 0) {
        try {
          const ollamaRes = await fetch(`${settings?.ollama_url ?? 'http://127.0.0.1:11434'}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: settings?.model ?? 'qwen3:1.7b',
              stream: false,
              messages: [
                {
                  role: 'system',
                  content: 'Summarize the following research content. Provide key findings, organized by topic. Use markdown. Keep it concise.',
                },
                { role: 'user', content: `Research query: ${query}\n\nContent:\n${summaries.join('\n\n')}` },
              ],
              options: { temperature: 0.3, num_predict: 500 },
            }),
            signal: AbortSignal.timeout(30000),
          });
          if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            summary = data.message?.content ?? '';
          }
        } catch {
          // use raw content instead
        }
      }

      if (!summary && summaries.length > 0) {
        summary = summaries.join('\n\n---\n\n');
      } else if (!summary) {
        summary = 'Research completed. See sources below for detailed information.';
      }

      await supabase.from('research_tasks').update({ status: 'completed', summary }).eq('id', taskId);

      setTasks((prev) => [{ ...task, status: 'completed', summary, sources } as ResearchTask, ...prev]);
      setQuery('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Research failed';
      await supabase.from('research_tasks').update({ status: 'failed' }).eq('id', taskId);
      setError(msg);
      setTasks((prev) => [{ ...task, status: 'failed' } as ResearchTask, ...prev]);
    } finally {
      setResearching(false);
    }
  }

  async function saveToLibrary(task: ResearchTask) {
    const { data } = await supabase
      .from('knowledge_documents')
      .insert({
        title: `Research: ${task.query}`,
        content: task.summary,
        source_type: 'research',
        source_url: task.sources[0]?.url ?? null,
        tags: ['research', task.query.split(' ').slice(0, 3).join('-')],
        indexed: true,
      })
      .select('*')
      .maybeSingle();

    if (data) {
      await supabase.from('research_tasks').update({ saved_to_library: true }).eq('id', task.id);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, saved_to_library: true } : t)));
    }
  }

  async function deleteTask(id: string) {
    await supabase.from('research_tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <SectionLoader />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
            <Globe size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Online Research</h1>
            <p className="text-xs text-[var(--text-muted)]">Search the web and save findings to your knowledge library</p>
          </div>
        </div>

        {/* Online status */}
        <div className="glass rounded-xl p-3 mb-4 flex items-center gap-2">
          <StatusDot connected={online} />
          <span className={`text-sm ${online ? 'text-emerald-400' : 'text-red-400'}`}>
            {online ? 'Online — research available' : 'Offline — research unavailable'}
          </span>
        </div>

        {/* Search bar */}
        <div className="glass-strong rounded-2xl border border-[var(--border-default)] p-2 mb-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startResearch()}
              placeholder="What would you like Deva to research?"
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 outline-none"
              disabled={researching}
            />
            <button onClick={startResearch} disabled={!query.trim() || researching || !online} className="btn-primary text-sm">
              {researching ? <span className="typing-dot" /> : <><Search size={16} /> Research</>}
            </button>
          </div>
        </div>

        {error && (
          <div className="glass rounded-xl p-3 border-l-4 border-red-500 flex items-start gap-2 mb-4 animate-fade-in-up">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Research tasks */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={<Globe size={28} />}
            title="No research yet"
            description="Enter a topic above and Deva will search the web, extract content, and generate a summary you can save to your knowledge library."
          />
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="glass rounded-xl p-5 animate-fade-in-up">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)]">{new Date(task.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status === 'completed' && !task.saved_to_library && (
                      <button onClick={() => saveToLibrary(task)} className="btn-secondary text-xs py-1.5 px-3">
                        <BookPlus size={14} /> Save to Library
                      </button>
                    )}
                    {task.saved_to_library && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check size={14} /> Saved
                      </span>
                    )}
                    <button onClick={() => deleteTask(task.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-md hover:bg-white/5">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{task.query}</h3>

                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    task.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                    task.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                    'bg-amber-500/15 text-amber-400'
                  }`}>
                    {task.status}
                  </span>
                </div>

                {task.summary && (
                  <div className="glass rounded-lg p-3 mb-3 max-h-[300px] overflow-y-auto">
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{task.summary}</p>
                  </div>
                )}

                {task.sources && task.sources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--text-muted)] font-semibold">Sources:</p>
                    {task.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-[var(--accent-primary)] hover:underline group"
                      >
                        <ExternalLink size={12} className="flex-shrink-0" />
                        <span className="truncate">{src.title || src.url}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
