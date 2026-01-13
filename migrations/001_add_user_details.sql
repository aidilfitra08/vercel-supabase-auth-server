-- Migration: Add user_details table for AI personalization
-- Run this after creating the app_users table

-- Create user_details table
CREATE TABLE IF NOT EXISTS public.user_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  personal_info JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  llm_model TEXT NOT NULL DEFAULT 'gemini',
  llm_config JSONB DEFAULT '{
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 2048
  }'::jsonb,
  embedding_provider TEXT NOT NULL DEFAULT 'gemini',
  embedding_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_details_user_id ON user_details(user_id);

-- Add unique constraint to ensure one detail record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_details_user_id_unique ON user_details(user_id);

-- Add comments for documentation
COMMENT ON TABLE user_details IS 'Stores AI personalization settings and conversation history for each user';
COMMENT ON COLUMN user_details.preferences IS 'User preferences for AI behavior (tone, language, etc.)';
COMMENT ON COLUMN user_details.personal_info IS 'Personal information for AI context (name, interests, etc.)';
COMMENT ON COLUMN user_details.conversation_history IS 'Recent conversation messages for context';
COMMENT ON COLUMN user_details.llm_model IS 'Current LLM model: gemini, gpt, or ollama';
COMMENT ON COLUMN user_details.llm_config IS 'LLM-specific configuration (model name, temperature, maxTokens)';
COMMENT ON COLUMN user_details.embedding_provider IS 'Embedding provider: gemini or fastapi';
COMMENT ON COLUMN user_details.embedding_config IS 'Embedding-specific configuration';

-- Optional: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_details_updated_at BEFORE UPDATE ON user_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
