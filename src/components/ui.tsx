import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return result;
}

export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeContent: string[] = [];
  let inList = false;
  let inOrdered = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const code = escapeHtml(codeContent.join('\n'));
        html.push(`<pre><code>${code}</code></pre>`);
        inCodeBlock = false;
        codeContent = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    if (line.match(/^#{1,3}\s/)) {
      if (inList) { html.push(inOrdered ? '</ol>' : '</ul>'); inList = false; }
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const content = renderInline(line.replace(/^#+\s/, ''));
      html.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    if (line.match(/^>\s/)) {
      if (inList) { html.push(inOrdered ? '</ol>' : '</ul>'); inList = false; }
      const content = renderInline(line.replace(/^>\s/, ''));
      html.push(`<blockquote>${content}</blockquote>`);
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      if (!inList || !inOrdered) {
        if (inList) html.push('</ul>');
        html.push('<ol>');
        inList = true;
        inOrdered = true;
      }
      const content = renderInline(line.replace(/^\d+\.\s/, ''));
      html.push(`<li>${content}</li>`);
      continue;
    }

    if (line.match(/^[-*]\s/)) {
      if (!inList || inOrdered) {
        if (inList) html.push('</ol>');
        html.push('<ul>');
        inList = true;
        inOrdered = false;
      }
      const content = renderInline(line.replace(/^[-*]\s/, ''));
      html.push(`<li>${content}</li>`);
      continue;
    }

    if (inList) {
      html.push(inOrdered ? '</ol>' : '</ul>');
      inList = false;
    }

    if (line.trim() === '') {
      html.push('');
    } else {
      html.push(`<p>${renderInline(line)}</p>`);
    }
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`);
  }
  if (inList) html.push(inOrdered ? '</ol>' : '</ul>');

  return html.join('\n');
}

export function MarkdownRenderer({ content }: { content: string }) {
  const html = renderMarkdown(content);
  return <div className="message-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function Toast({ message, type = 'info' }: { message: string; type?: 'info' | 'success' | 'error' }) {
  const colors = {
    info: 'border-[var(--accent-primary)]',
    success: 'border-emerald-500',
    error: 'border-red-500',
  };
  return (
    <div className={`toast fixed bottom-6 right-6 z-50 glass-strong px-5 py-3 rounded-xl border-l-4 ${colors[type]} shadow-2xl`}>
      <p className="text-sm text-[var(--text-primary)]">{message}</p>
    </div>
  );
}

export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className="relative flex items-center justify-center w-2 h-2">
      <span className={`absolute inset-0 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} animate-ping opacity-60`} />
      <span className={`relative w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-5 text-[var(--accent-primary)]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-transparent"
      style={{
        width: size,
        height: size,
        borderTopColor: 'var(--accent-primary)',
        borderRightColor: 'var(--accent-secondary)',
      }}
    />
  );
}

export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner size={32} />
    </div>
  );
}
