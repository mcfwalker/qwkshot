export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      models: {
        Row: {
          id: string
          created_at: string
          name: string
          description?: string
          file_url: string
          thumbnail_url?: string
          metadata: Json
          tags?: string[]
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string
          file_url: string
          thumbnail_url?: string
          metadata?: Json
          tags?: string[]
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string
          file_url?: string
          thumbnail_url?: string
          metadata?: Json
          tags?: string[]
          user_id?: string
        }
      }
      llm_state: {
        Row: {
          id: number
          active_provider: string | null
        }
        Insert: {
          id?: number
          active_provider?: string | null
        }
        Update: {
          id?: number
          active_provider?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 