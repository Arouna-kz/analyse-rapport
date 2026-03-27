export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_config: {
        Row: {
          config_key: string
          config_value: string
          description: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          model: string
          output_tokens: number | null
          provider: string
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model: string
          output_tokens?: number | null
          provider: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model?: string
          output_tokens?: number | null
          provider?: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          checksum: string | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          session_id: string | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          checksum?: string | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          checksum?: string | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number | null
          payload: Json | null
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          payload?: Json | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          payload?: Json | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_share_views: {
        Row: {
          city: string | null
          country: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          referrer: string | null
          share_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          referrer?: string | null
          share_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          referrer?: string | null
          share_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_share_views_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "prediction_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          prediction_id: string
          share_token: string
          view_count: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          prediction_id: string
          share_token: string
          view_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          prediction_id?: string
          share_token?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_shares_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "saved_prediction_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string | null
          detected_value: Json | null
          id: string
          is_acknowledged: boolean | null
          message: string
          report_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          trigger_condition: Json | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string | null
          detected_value?: Json | null
          id?: string
          is_acknowledged?: boolean | null
          message: string
          report_id?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          trigger_condition?: Json | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string | null
          detected_value?: Json | null
          id?: string
          is_acknowledged?: boolean | null
          message?: string
          report_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          trigger_condition?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "report_alerts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_analyses: {
        Row: {
          arena_metadata: Json | null
          arena_score: number | null
          created_at: string
          id: string
          insights: string | null
          key_points: string[] | null
          kpis: Json | null
          report_id: string
          summary: string | null
        }
        Insert: {
          arena_metadata?: Json | null
          arena_score?: number | null
          created_at?: string
          id?: string
          insights?: string | null
          key_points?: string[] | null
          kpis?: Json | null
          report_id: string
          summary?: string | null
        }
        Update: {
          arena_metadata?: Json | null
          arena_score?: number | null
          created_at?: string
          id?: string
          insights?: string | null
          key_points?: string[] | null
          kpis?: Json | null
          report_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_analyses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_consolidations: {
        Row: {
          conflict_resolution: Json | null
          consolidation_strategy: Database["public"]["Enums"]["consolidation_strategy"]
          created_at: string | null
          created_by: string
          id: string
          merged_content: Json | null
          merged_kpis: Json | null
          name: string
          source_report_ids: string[]
          status: string | null
        }
        Insert: {
          conflict_resolution?: Json | null
          consolidation_strategy: Database["public"]["Enums"]["consolidation_strategy"]
          created_at?: string | null
          created_by: string
          id?: string
          merged_content?: Json | null
          merged_kpis?: Json | null
          name: string
          source_report_ids: string[]
          status?: string | null
        }
        Update: {
          conflict_resolution?: Json | null
          consolidation_strategy?: Database["public"]["Enums"]["consolidation_strategy"]
          created_at?: string | null
          created_by?: string
          id?: string
          merged_content?: Json | null
          merged_kpis?: Json | null
          name?: string
          source_report_ids?: string[]
          status?: string | null
        }
        Relationships: []
      }
      report_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          report_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          report_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_embeddings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_predictions: {
        Row: {
          assumptions: string[] | null
          base_reports: string[]
          confidence_scores: Json | null
          created_at: string | null
          created_by: string
          id: string
          methodology: Json | null
          predicted_kpis: Json | null
          prediction_type: Database["public"]["Enums"]["prediction_type"]
          recommendations: string[] | null
          risk_factors: string[] | null
        }
        Insert: {
          assumptions?: string[] | null
          base_reports: string[]
          confidence_scores?: Json | null
          created_at?: string | null
          created_by: string
          id?: string
          methodology?: Json | null
          predicted_kpis?: Json | null
          prediction_type: Database["public"]["Enums"]["prediction_type"]
          recommendations?: string[] | null
          risk_factors?: string[] | null
        }
        Update: {
          assumptions?: string[] | null
          base_reports?: string[]
          confidence_scores?: Json | null
          created_at?: string | null
          created_by?: string
          id?: string
          methodology?: Json | null
          predicted_kpis?: Json | null
          prediction_type?: Database["public"]["Enums"]["prediction_type"]
          recommendations?: string[] | null
          risk_factors?: string[] | null
        }
        Relationships: []
      }
      report_validations: {
        Row: {
          annotations: Json | null
          corrections: Json | null
          created_at: string | null
          feedback: string | null
          id: string
          report_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["validation_status"]
          validation_score: number | null
          validator_id: string
        }
        Insert: {
          annotations?: Json | null
          corrections?: Json | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          report_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          validation_score?: number | null
          validator_id: string
        }
        Update: {
          annotations?: Json | null
          corrections?: Json | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          report_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          validation_score?: number | null
          validator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_validations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          change_reason: string | null
          changed_by: string
          content_snapshot: Json
          created_at: string | null
          delta: Json | null
          id: string
          is_published: boolean | null
          metadata: Json | null
          report_id: string
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          content_snapshot: Json
          created_at?: string | null
          delta?: Json | null
          id?: string
          is_published?: boolean | null
          metadata?: Json | null
          report_id: string
          version_number: number
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          content_snapshot?: Json
          created_at?: string | null
          delta?: Json | null
          id?: string
          is_published?: boolean | null
          metadata?: Json | null
          report_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          file_path: string | null
          file_type: string | null
          id: string
          metadata: Json | null
          report_type: Database["public"]["Enums"]["report_type"]
          status: Database["public"]["Enums"]["report_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          report_type?: Database["public"]["Enums"]["report_type"]
          status?: Database["public"]["Enums"]["report_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          report_type?: Database["public"]["Enums"]["report_type"]
          status?: Database["public"]["Enums"]["report_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_prediction_scenarios: {
        Row: {
          base_report_ids: string[]
          created_at: string
          created_by: string
          id: string
          metadata: Json | null
          name: string
          predictions: Json
        }
        Insert: {
          base_report_ids: string[]
          created_at?: string
          created_by: string
          id?: string
          metadata?: Json | null
          name: string
          predictions?: Json
        }
        Update: {
          base_report_ids?: string[]
          created_at?: string
          created_by?: string
          id?: string
          metadata?: Json | null
          name?: string
          predictions?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          scope: Json | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: Json | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      detect_anomalies: {
        Args: { _kpi_name: string; _report_id: string; _threshold?: number }
        Returns: {
          anomaly_detected: boolean
          severity: string
          z_score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_similar_embeddings:
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              report_id: string
              similarity: number
            }[]
          }
        | {
            Args: {
              _user_id?: string
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              report_id: string
              similarity: number
            }[]
          }
    }
    Enums: {
      alert_severity: "low" | "medium" | "high" | "critical"
      alert_type:
        | "kpi_threshold_exceeded"
        | "anomaly_detected"
        | "trend_reversal"
        | "missing_data"
        | "quality_issue"
      app_role:
        | "super_admin"
        | "admin"
        | "analyst"
        | "reviewer"
        | "viewer"
        | "data_steward"
      consolidation_strategy:
        | "merge_sequential"
        | "merge_weighted"
        | "merge_smart_ai"
      prediction_type: "optimistic" | "realistic" | "pessimistic"
      report_status: "pending" | "processing" | "completed" | "error"
      report_type: "past" | "current" | "future"
      validation_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "needs_correction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["low", "medium", "high", "critical"],
      alert_type: [
        "kpi_threshold_exceeded",
        "anomaly_detected",
        "trend_reversal",
        "missing_data",
        "quality_issue",
      ],
      app_role: [
        "super_admin",
        "admin",
        "analyst",
        "reviewer",
        "viewer",
        "data_steward",
      ],
      consolidation_strategy: [
        "merge_sequential",
        "merge_weighted",
        "merge_smart_ai",
      ],
      prediction_type: ["optimistic", "realistic", "pessimistic"],
      report_status: ["pending", "processing", "completed", "error"],
      report_type: ["past", "current", "future"],
      validation_status: [
        "pending_review",
        "approved",
        "rejected",
        "needs_correction",
      ],
    },
  },
} as const
