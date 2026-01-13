export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  approved: boolean;
  created_at: string;
}

export interface UserDetailRecord {
  id: string;
  user_id: string;
  preferences: Record<string, any>;
  personal_info: Record<string, any>;
  conversation_history: ChatMessageRecord[];
  llm_model: string;
  llm_config: Record<string, any>;
  embedding_provider: string;
  embedding_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  context?: string[];
}

export interface ChatResponse {
  response: string;
  message: string;
}

export interface EmbedRequest {
  text?: string;
  texts?: string[];
}

export interface EmbedResponse {
  embedding?: number[];
  embeddings?: number[][];
}

export interface SettingsUpdateRequest {
  llm_model?: string;
  llm_config?: Record<string, any>;
  embedding_provider?: string;
  embedding_config?: Record<string, any>;
  preferences?: Record<string, any>;
  personal_info?: Record<string, any>;
}
