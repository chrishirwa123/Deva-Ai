export type Role = 'user' | 'assistant' | 'system';

export interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  model: string | null;
  created_at: string;
}

export interface Memory {
  id: string;
  category: string;
  content: string;
  source: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source_type: string;
  source_url: string | null;
  tags: string[];
  indexed: boolean;
  created_at: string;
  updated_at: string;
}

export interface OwnerProfile {
  id: number;
  name: string;
  preferred_name: string;
  skills: string[];
  interests: string[];
  goals: string[];
  communication_preferences: string;
  projects: string[];
  additional_info: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  ollama_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  ai_display_name: string;
  theme: string;
  accent_color: string;
  animation_intensity: string;
  search_provider: string;
  search_api_key: string;
  voice_input_enabled: boolean;
  speech_output_enabled: boolean;
  voice_uri: string;
  speech_rate: number;
  online_mode: boolean;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchTask {
  id: string;
  query: string;
  status: 'pending' | 'searching' | 'fetching' | 'summarizing' | 'completed' | 'failed';
  summary: string;
  sources: ResearchSource[];
  saved_to_library: boolean;
  created_at: string;
  updated_at: string;
}

export interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
}

export interface OllamaStatus {
  connected: boolean;
  models: OllamaModel[];
  error?: string;
}

export type Page =
  | 'landing'
  | 'chat'
  | 'assistant'
  | 'memory'
  | 'knowledge'
  | 'research'
  | 'profile'
  | 'settings';
