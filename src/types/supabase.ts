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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bracket_picks: {
        Row: {
          id: string
          slot_id: string
          submitted_at: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          slot_id: string
          submitted_at?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          slot_id?: string
          submitted_at?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_picks_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "bracket_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_picks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_slots: {
        Row: {
          created_at: string
          fixture_id: string | null
          id: string
          parent_slot_id: string | null
          resolved_team_id: string | null
          slot_code: string
          stage: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          fixture_id?: string | null
          id?: string
          parent_slot_id?: string | null
          resolved_team_id?: string | null
          slot_code: string
          stage: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: string | null
          id?: string
          parent_slot_id?: string | null
          resolved_team_id?: string | null
          slot_code?: string
          stage?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_slots_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_slots_parent_slot_id_fkey"
            columns: ["parent_slot_id"]
            isOneToOne: false
            referencedRelation: "bracket_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_slots_resolved_team_id_fkey"
            columns: ["resolved_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_slots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          auto_fetched_at: string | null
          away_placeholder: string | null
          away_team_id: string | null
          created_at: string
          external_match_no: number
          group_code: string | null
          home_placeholder: string | null
          home_team_id: string | null
          id: string
          kickoff_at: string
          result_away: number | null
          result_away_90min: number | null
          result_away_full: number | null
          result_home: number | null
          result_home_90min: number | null
          result_home_full: number | null
          stage: string
          tournament_id: string
          updated_at: string
          venue_code: string | null
        }
        Insert: {
          auto_fetched_at?: string | null
          away_placeholder?: string | null
          away_team_id?: string | null
          created_at?: string
          external_match_no: number
          group_code?: string | null
          home_placeholder?: string | null
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          result_away?: number | null
          result_away_90min?: number | null
          result_away_full?: number | null
          result_home?: number | null
          result_home_90min?: number | null
          result_home_full?: number | null
          stage: string
          tournament_id: string
          updated_at?: string
          venue_code?: string | null
        }
        Update: {
          auto_fetched_at?: string | null
          away_placeholder?: string | null
          away_team_id?: string | null
          created_at?: string
          external_match_no?: number
          group_code?: string | null
          home_placeholder?: string | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          result_away?: number | null
          result_away_90min?: number | null
          result_away_full?: number | null
          result_home?: number | null
          result_home_90min?: number | null
          result_home_full?: number | null
          stage?: string
          tournament_id?: string
          updated_at?: string
          venue_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_score: number
          fixture_id: string
          home_score: number
          id: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          fixture_id: string
          home_score: number
          id?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          fixture_id?: string
          home_score?: number
          id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          display_name: string
          display_name_normalized: string | null
          is_admin: boolean
          joined_at: string
          locale: string
          user_id: string
        }
        Insert: {
          display_name: string
          display_name_normalized?: string | null
          is_admin?: boolean
          joined_at?: string
          locale?: string
          user_id: string
        }
        Update: {
          display_name?: string
          display_name_normalized?: string | null
          is_admin?: boolean
          joined_at?: string
          locale?: string
          user_id?: string
        }
        Relationships: []
      }
      prop_answers: {
        Row: {
          answer: string
          id: string
          question_id: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer: string
          id?: string
          question_id: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          id?: string
          question_id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prop_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "prop_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      prop_questions: {
        Row: {
          answer_type: string
          code: string
          correct_answer: string | null
          correct_answer_aliases: string[]
          created_at: string
          id: string
          points: number
          prompt_en: string
          prompt_he: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          answer_type: string
          code: string
          correct_answer?: string | null
          correct_answer_aliases?: string[]
          created_at?: string
          id?: string
          points?: number
          prompt_en: string
          prompt_he: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          answer_type?: string
          code?: string
          correct_answer?: string | null
          correct_answer_aliases?: string[]
          created_at?: string
          id?: string
          points?: number
          prompt_en?: string
          prompt_he?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prop_questions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          kind: string | null
          points: number
          ref_id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          kind?: string | null
          points: number
          ref_id: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          kind?: string | null
          points?: number
          ref_id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          code: string
          created_at: string
          group_code: string | null
          id: string
          name_en: string
          name_he: string
          tournament_id: string
        }
        Insert: {
          code: string
          created_at?: string
          group_code?: string | null
          id?: string
          name_en: string
          name_he: string
          tournament_id: string
        }
        Update: {
          code?: string
          created_at?: string
          group_code?: string | null
          id?: string
          name_en?: string
          name_he?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament: {
        Row: {
          code: string
          created_at: string
          ends_at: string
          id: string
          name_en: string
          name_he: string
          starts_at: string
        }
        Insert: {
          code: string
          created_at?: string
          ends_at: string
          id?: string
          name_en: string
          name_he: string
          starts_at: string
        }
        Update: {
          code?: string
          created_at?: string
          ends_at?: string
          id?: string
          name_en?: string
          name_he?: string
          starts_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_leaderboard: {
        Row: {
          bracket_total: number | null
          correct_count: number | null
          display_name: string | null
          exact_count: number | null
          league_total: number | null
          props_total: number | null
          total: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
