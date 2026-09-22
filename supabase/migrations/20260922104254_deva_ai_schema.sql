/*
# Deva AI — Complete Database Schema

## Overview
Creates the full persistence layer for Deva AI, a local-first personal AI assistant.
All tables are single-tenant (no auth/sign-in) — the app runs locally for one owner.
All policies use `TO anon, authenticated` so the anon-key frontend can read/write its own data.

## New Tables
1. `conversations` — Chat conversation threads (title, model, timestamps)
2. `messages` — Individual messages within conversations (role, content, timestamps)
3. `memories` — Long-term verified facts about the owner (category, content, source)
4. `knowledge_documents` — Uploaded documents and research findings (title, content, tags, source)
5. `owner_profile` — Single-row owner identity and profile data
6. `app_settings` — Single-row application settings (Ollama URL, model, temperature, etc.)
7. `research_tasks` — Online research job records (query, status, summary, sources)

## Security
- RLS enabled on every table.
- All tables allow anon+authenticated full CRUD (single-tenant local app).
- No user_id columns — data is intentionally shared/local.
*/

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Conversation',
  model text DEFAULT 'qwen3:1.7b',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversations" ON conversations;
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversations" ON conversations;
CREATE POLICY "anon_update_conversations" ON conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON conversations;
CREATE POLICY "anon_delete_conversations" ON conversations FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================================
-- MEMORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  source text DEFAULT 'manual',
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_memories" ON memories;
CREATE POLICY "anon_select_memories" ON memories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_memories" ON memories;
CREATE POLICY "anon_insert_memories" ON memories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_memories" ON memories;
CREATE POLICY "anon_update_memories" ON memories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_memories" ON memories;
CREATE POLICY "anon_delete_memories" ON memories FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- KNOWLEDGE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  tags text[] DEFAULT '{}',
  indexed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_knowledge_documents" ON knowledge_documents;
CREATE POLICY "anon_select_knowledge_documents" ON knowledge_documents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_knowledge_documents" ON knowledge_documents;
CREATE POLICY "anon_insert_knowledge_documents" ON knowledge_documents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_knowledge_documents" ON knowledge_documents;
CREATE POLICY "anon_update_knowledge_documents" ON knowledge_documents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_knowledge_documents" ON knowledge_documents;
CREATE POLICY "anon_delete_knowledge_documents" ON knowledge_documents FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- OWNER PROFILE (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS owner_profile (
  id integer PRIMARY KEY DEFAULT 1,
  name text NOT NULL DEFAULT 'Hirwa Christian',
  preferred_name text DEFAULT 'Christian',
  skills text[] DEFAULT '{}',
  interests text[] DEFAULT '{}',
  goals text[] DEFAULT '{}',
  communication_preferences text DEFAULT '',
  projects text[] DEFAULT '{}',
  additional_info text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE owner_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_owner_profile" ON owner_profile;
CREATE POLICY "anon_select_owner_profile" ON owner_profile FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_owner_profile" ON owner_profile;
CREATE POLICY "anon_insert_owner_profile" ON owner_profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_owner_profile" ON owner_profile;
CREATE POLICY "anon_update_owner_profile" ON owner_profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_owner_profile" ON owner_profile;
CREATE POLICY "anon_delete_owner_profile" ON owner_profile FOR DELETE
  TO anon, authenticated USING (true);

-- Insert default profile row
INSERT INTO owner_profile (id, name, preferred_name, skills, interests, goals, communication_preferences, projects, additional_info)
VALUES (1, 'Hirwa Christian', 'Christian', '{}', '{}', '{}', '', '{}', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- APP SETTINGS (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  ollama_url text NOT NULL DEFAULT 'http://127.0.0.1:11434',
  model text NOT NULL DEFAULT 'qwen3:1.7b',
  temperature real NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 2048,
  system_prompt text NOT NULL DEFAULT '',
  ai_display_name text NOT NULL DEFAULT 'Deva AI',
  theme text NOT NULL DEFAULT 'dark',
  accent_color text NOT NULL DEFAULT 'violet',
  animation_intensity text NOT NULL DEFAULT 'normal',
  search_provider text NOT NULL DEFAULT 'duckduckgo',
  search_api_key text DEFAULT '',
  voice_input_enabled boolean NOT NULL DEFAULT true,
  speech_output_enabled boolean NOT NULL DEFAULT false,
  voice_uri text DEFAULT '',
  speech_rate real NOT NULL DEFAULT 1.0,
  online_mode boolean NOT NULL DEFAULT false,
  CONSTRAINT single_row_settings CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Insert default settings row
INSERT INTO app_settings (id, ollama_url, model, temperature, max_tokens, system_prompt, ai_display_name, theme, accent_color, animation_intensity, search_provider, search_api_key, voice_input_enabled, speech_output_enabled, voice_uri, speech_rate, online_mode)
VALUES (1, 'http://127.0.0.1:11434', 'qwen3:1.7b', 0.7, 2048, '', 'Deva AI', 'dark', 'violet', 'normal', 'duckduckgo', '', true, false, '', 1.0, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RESEARCH TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS research_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'fetching', 'summarizing', 'completed', 'failed')),
  summary text DEFAULT '',
  sources jsonb DEFAULT '[]'::jsonb,
  saved_to_library boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE research_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_research_tasks" ON research_tasks;
CREATE POLICY "anon_select_research_tasks" ON research_tasks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_research_tasks" ON research_tasks;
CREATE POLICY "anon_insert_research_tasks" ON research_tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_research_tasks" ON research_tasks;
CREATE POLICY "anon_update_research_tasks" ON research_tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_research_tasks" ON research_tasks;
CREATE POLICY "anon_delete_research_tasks" ON research_tasks FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_memories_updated_at ON memories;
CREATE TRIGGER trg_memories_updated_at BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_knowledge_documents_updated_at ON knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_updated_at BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_owner_profile_updated_at ON owner_profile;
CREATE TRIGGER trg_owner_profile_updated_at BEFORE UPDATE ON owner_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_research_tasks_updated_at ON research_tasks;
CREATE TRIGGER trg_research_tasks_updated_at BEFORE UPDATE ON research_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();