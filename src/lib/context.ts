import { supabase } from './supabase';
import type { AppSettings, OwnerProfile, Memory, KnowledgeDocument } from './types';
import type { ChatMessage } from './ollama';

const IDENTITY_PROMPT = `You are Deva AI, a personal AI assistant created by Hirwa Christian.
Your primary owner is Hirwa Christian.
Your purpose is to be a personal AI assistant, coding companion, learning partner, and productivity assistant.
You are designed for local-first use, running through Ollama on the owner's machine.
If asked who created you, say Hirwa Christian.
If asked your name, say Deva AI.
If asked about your purpose, explain that you are a personal local-first AI assistant.
Be helpful, concise, and thoughtful. Use markdown formatting when appropriate.`;

export function getIdentityPrompt(settings: AppSettings | null): string {
  const base = settings?.system_prompt?.trim()
    ? `${IDENTITY_PROMPT}\n\nAdditional instructions from the owner:\n${settings.system_prompt}`
    : IDENTITY_PROMPT;
  return base;
}

export async function buildContextMessages(
  conversationId: string,
  userMessage: string,
  settings: AppSettings | null,
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];

  // System prompt with identity
  let systemContent = getIdentityPrompt(settings);

  // Load owner profile
  const { data: profile } = await supabase
    .from('owner_profile')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (profile) {
    const p = profile as OwnerProfile;
    const profileParts: string[] = [`Owner: ${p.name}`];
    if (p.preferred_name) profileParts.push(`Preferred name: ${p.preferred_name}`);
    if (p.skills?.length) profileParts.push(`Skills: ${p.skills.join(', ')}`);
    if (p.interests?.length) profileParts.push(`Interests: ${p.interests.join(', ')}`);
    if (p.goals?.length) profileParts.push(`Goals: ${p.goals.join(', ')}`);
    if (p.communication_preferences) profileParts.push(`Communication preferences: ${p.communication_preferences}`);
    if (p.projects?.length) profileParts.push(`Projects: ${p.projects.join(', ')}`);
    if (p.additional_info) profileParts.push(`Additional info: ${p.additional_info}`);
    systemContent += `\n\n--- Owner Profile ---\n${profileParts.join('\n')}`;
  }

  // Load relevant memories (simple keyword matching)
  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (memories && memories.length > 0) {
    const memText = (memories as Memory[])
      .map((m) => `- [${m.category}] ${m.content}`)
      .join('\n');
    systemContent += `\n\n--- Known Facts About the Owner ---\n${memText}`;
  }

  // Load relevant knowledge documents (simple keyword search)
  const words = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 10);
  if (words.length > 0) {
    const { data: docs } = await supabase
      .from('knowledge_documents')
      .select('title,content')
      .limit(5);

    if (docs && docs.length > 0) {
      const relevantDocs = (docs as KnowledgeDocument[]).filter((d) => {
        const lower = (d.title + ' ' + d.content).toLowerCase();
        return words.some((w) => lower.includes(w));
      });

      if (relevantDocs.length > 0) {
        const docText = relevantDocs
          .map((d) => `### ${d.title}\n${d.content.slice(0, 800)}`)
          .join('\n\n');
        systemContent += `\n\n--- Relevant Knowledge ---\n${docText}`;
      }
    }
  }

  messages.push({ role: 'system', content: systemContent });

  // Load conversation history
  const { data: history } = await supabase
    .from('messages')
    .select('role,content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(30);

  if (history) {
    for (const msg of history as { role: string; content: string }[]) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }
  }

  // Add the new user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

export async function extractMemory(
  baseUrl: string,
  model: string,
  userMessage: string,
  assistantResponse: string,
): Promise<string | null> {
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
            content: `Analyze the following conversation exchange. Determine if the user stated a personal fact, preference, or important detail that should be remembered long-term.
If yes, respond with ONLY the fact as a single concise sentence (no preamble, no "remember that").
If no clear fact was stated, respond with exactly "NONE".
Do not extract opinions, questions, or temporary information.`,
          },
          {
            role: 'user',
            content: `User: ${userMessage}\nAssistant: ${assistantResponse}`,
          },
        ],
        options: { temperature: 0.2, num_predict: 100 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = (data.message?.content ?? '').trim();
    if (result && result.toUpperCase() !== 'NONE' && result.length > 5) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveMemory(content: string, category = 'auto', source = 'auto-extracted') {
  const { error } = await supabase
    .from('memories')
    .insert({ content, category, source, approved: true });
  return !error;
}

export { IDENTITY_PROMPT };
