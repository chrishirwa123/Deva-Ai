import type { OllamaModel, OllamaStatus, Role } from './types';

export interface ChatMessage {
  role: Role;
  content: string;
}

export async function checkOllamaStatus(baseUrl: string): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      connected: true,
      models: (data.models ?? []).map((m: { name: string; size?: number; modified_at?: string }) => ({
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { connected: false, models: [], error: msg };
  }
}

export async function streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  options: { temperature: number; max_tokens: number },
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature: options.temperature,
        num_predict: options.max_tokens,
      },
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${errText || res.statusText}`);
  }

  if (!res.body) throw new Error('No response body from Ollama');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) {
          fullContent += json.message.content;
          onToken(json.message.content);
        }
        if (json.done) return fullContent;
      } catch {
        // partial JSON, skip
      }
    }
  }
  return fullContent;
}

export async function generateTitle(
  baseUrl: string,
  model: string,
  firstMessage: string,
): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'Generate a short 2-5 word title for this conversation. Reply with ONLY the title, no quotes, no punctuation.',
          },
          { role: 'user', content: firstMessage },
        ],
        options: { temperature: 0.3, num_predict: 30 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('title generation failed');
    const data = await res.json();
    const title = (data.message?.content ?? '').trim().replace(/["']/g, '').slice(0, 60);
    return title || 'New Conversation';
  } catch {
    return firstMessage.slice(0, 50);
  }
}

export { type OllamaModel };
