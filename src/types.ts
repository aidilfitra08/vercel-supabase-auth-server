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
