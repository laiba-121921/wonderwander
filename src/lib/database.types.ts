// From the Supabase type generator, condensed (each Update is Partial<Insert>). Regenerate after every migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          instance_name: string;
          one: boolean;
          user_cap: number;
        };
        Insert: {
          instance_name?: string;
          one?: boolean;
          user_cap?: number;
        };
        Update: Partial<Database['public']['Tables']['app_config']['Insert']>;
        Relationships: [];
      };
      attempt: {
        Row: {
          answer_text: string;
          appealable: boolean;
          auditor: Json | null;
          confidence: string | null;
          context: Json | null;
          created_at: string;
          decision: Database['public']['Enums']['verdict'];
          exercise_text: string;
          grader: Json | null;
          id: string;
          item_class: string;
          item_id: string;
          key_version: number | null;
          retry_of: string | null;
          source: Database['public']['Enums']['attempt_source'];
          user_id: string;
          variant_id: string | null;
        };
        Insert: {
          answer_text: string;
          appealable?: boolean;
          auditor?: Json | null;
          confidence?: string | null;
          context?: Json | null;
          created_at?: string;
          decision: Database['public']['Enums']['verdict'];
          exercise_text: string;
          grader?: Json | null;
          id?: string;
          item_class: string;
          item_id: string;
          key_version?: number | null;
          retry_of?: string | null;
          source: Database['public']['Enums']['attempt_source'];
          user_id?: string;
          variant_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['attempt']['Insert']>;
        Relationships: [];
      };
      boss_session: {
        Row: {
          attempt_id: string | null;
          boss_id: string;
          created_at: string;
          id: string;
          level: number;
          phase: string;
          status: string;
          transcript: Json;
          user_id: string;
        };
        Insert: {
          attempt_id?: string | null;
          boss_id: string;
          created_at?: string;
          id?: string;
          level?: number;
          phase?: string;
          status?: string;
          transcript?: Json;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['boss_session']['Insert']>;
        Relationships: [
          { foreignKeyName: 'boss_session_attempt_id_fkey'; columns: ['attempt_id']; isOneToOne: false; referencedRelation: 'attempt'; referencedColumns: ['id'] },
        ];
      };
      card_review: {
        Row: {
          attempt_id: string | null;
          card_id: string;
          id: string;
          rating: number;
          reviewed_at: string;
          user_id: string;
        };
        Insert: {
          attempt_id?: string | null;
          card_id: string;
          id?: string;
          rating: number;
          reviewed_at?: string;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['card_review']['Insert']>;
        Relationships: [
          { foreignKeyName: 'card_review_attempt_id_fkey'; columns: ['attempt_id']; isOneToOne: false; referencedRelation: 'attempt'; referencedColumns: ['id'] },
        ];
      };
      card_state: {
        Row: {
          card_id: string;
          due: string;
          fsrs: Json;
          pass_days: string[];
          user_id: string;
        };
        Insert: {
          card_id: string;
          due: string;
          fsrs: Json;
          pass_days?: string[];
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['card_state']['Insert']>;
        Relationships: [];
      };
      invite: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          max_uses: number;
          uses: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          max_uses?: number;
          uses?: number;
        };
        Update: Partial<Database['public']['Tables']['invite']['Insert']>;
        Relationships: [];
      };
      item_state: {
        Row: {
          fail_count: number;
          item_id: string;
          last_attempt_id: string | null;
          last_feedback: string | null;
          locked_until: string | null;
          revision_done_at: string | null;
          status: Database['public']['Enums']['item_status'];
          unit_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          fail_count?: number;
          item_id: string;
          last_attempt_id?: string | null;
          last_feedback?: string | null;
          locked_until?: string | null;
          revision_done_at?: string | null;
          status?: Database['public']['Enums']['item_status'];
          unit_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['item_state']['Insert']>;
        Relationships: [];
      };
      key_override: {
        Row: {
          accept_add: string[];
          created_at: string;
          item_id: string;
          note: string | null;
          reject_add: string[];
          required_edit: string[] | null;
          user_id: string;
          version: number;
        };
        Insert: {
          accept_add?: string[];
          created_at?: string;
          item_id: string;
          note?: string | null;
          reject_add?: string[];
          required_edit?: string[] | null;
          user_id?: string;
          version: number;
        };
        Update: Partial<Database['public']['Tables']['key_override']['Insert']>;
        Relationships: [];
      };
      llm_rate: {
        Row: {
          calls: number;
          hour: string;
          user_id: string;
        };
        Insert: {
          calls?: number;
          hour: string;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['llm_rate']['Insert']>;
        Relationships: [];
      };
      llm_usage: {
        Row: {
          calls: number;
          mode: string;
          usage_date: string;
          user_id: string;
        };
        Insert: {
          calls?: number;
          mode: string;
          usage_date: string;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['llm_usage']['Insert']>;
        Relationships: [];
      };
      owner: {
        Row: {
          one: boolean;
          user_id: string;
        };
        Insert: {
          one?: boolean;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['owner']['Insert']>;
        Relationships: [];
      };
      profile: {
        Row: {
          created_at: string;
          display_name: string;
          onboarded: boolean;
          push_hour: number;
          push_threshold: number;
          timezone: string;
          track_rotation_start: string | null;
          user_id: string;
          weekend_day: number;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          onboarded?: boolean;
          push_hour?: number;
          push_threshold?: number;
          timezone?: string;
          track_rotation_start?: string | null;
          user_id?: string;
          weekend_day?: number;
        };
        Update: Partial<Database['public']['Tables']['profile']['Insert']>;
        Relationships: [];
      };
      push_subscription: {
        Row: {
          created_at: string;
          endpoint: string;
          keys: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          endpoint: string;
          keys: Json;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['push_subscription']['Insert']>;
        Relationships: [];
      };
      review_queue: {
        Row: {
          attempt_id: string;
          created_at: string;
          id: string;
          item_id: string;
          reason: string;
          ruled_at: string | null;
          ruling: Database['public']['Enums']['verdict'] | null;
          ruling_reason: string | null;
          status: Database['public']['Enums']['queue_status'];
          user_id: string;
        };
        Insert: {
          attempt_id: string;
          created_at?: string;
          id?: string;
          item_id: string;
          reason: string;
          ruled_at?: string | null;
          ruling?: Database['public']['Enums']['verdict'] | null;
          ruling_reason?: string | null;
          status?: Database['public']['Enums']['queue_status'];
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['review_queue']['Insert']>;
        Relationships: [
          { foreignKeyName: 'review_queue_attempt_id_fkey'; columns: ['attempt_id']; isOneToOne: false; referencedRelation: 'attempt'; referencedColumns: ['id'] },
        ];
      };
      session_log: {
        Row: {
          items_done: number;
          kind: string;
          local_date: string;
          minutes: number;
          track: string | null;
          user_id: string;
        };
        Insert: {
          items_done?: number;
          kind: string;
          local_date: string;
          minutes?: number;
          track?: string | null;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['session_log']['Insert']>;
        Relationships: [];
      };
      variant: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          structure_ok: boolean;
          text: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          structure_ok: boolean;
          text: string;
          used_at?: string | null;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['variant']['Insert']>;
        Relationships: [];
      };
      writing_submission: {
        Row: {
          attempt_id: string | null;
          created_at: string;
          domain_id: string | null;
          file_path: string | null;
          id: string;
          source: Database['public']['Enums']['attempt_source'];
          step: string;
          text: string;
          title: string | null;
          user_id: string;
          version: number;
          word_count: number;
        };
        Insert: {
          attempt_id?: string | null;
          created_at?: string;
          domain_id?: string | null;
          file_path?: string | null;
          id?: string;
          source: Database['public']['Enums']['attempt_source'];
          step: string;
          text: string;
          title?: string | null;
          user_id?: string;
          version?: number;
          word_count: number;
        };
        Update: Partial<Database['public']['Tables']['writing_submission']['Insert']>;
        Relationships: [
          { foreignKeyName: 'writing_submission_attempt_id_fkey'; columns: ['attempt_id']; isOneToOne: false; referencedRelation: 'attempt'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      bump_llm_rate: { Args: never; Returns: number };
      claim_invite: { Args: { p_claim: boolean; p_code: string }; Returns: string };
      drafts_bytes: { Args: never; Returns: number };
      instance_status: { Args: never; Returns: Json };
      is_owner: { Args: never; Returns: boolean };
      push_secret: { Args: { secret_name: string }; Returns: string };
      push_store_vapid: { Args: { keys: string }; Returns: undefined };
      release_invite: { Args: { p_code: string }; Returns: undefined };
    };
    Enums: {
      attempt_source: 'typed' | 'voice' | 'upload' | 'tap';
      item_status: 'available' | 'pending_review' | 'passed' | 'locked' | 'revision_required';
      queue_status: 'pending' | 'ruled';
      verdict: 'PASS' | 'FAIL' | 'ABSTAIN' | 'QUEUED' | 'RETRY';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
