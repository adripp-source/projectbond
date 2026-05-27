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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_read: boolean | null
          issue_id: string | null
          message: string
          scan_id: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          issue_id?: string | null
          message: string
          scan_id?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          issue_id?: string | null
          message?: string
          scan_id?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "scan_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      app_versions: {
        Row: {
          changelog: string | null
          created_at: string
          id: string
          title: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          id?: string
          title: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          id?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      branding: {
        Row: {
          company_name: string | null
          created_at: string
          escalation_email: string | null
          id: string
          positioning: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_twitter: string | null
          support_email: string | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          escalation_email?: string | null
          id?: string
          positioning?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          support_email?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          escalation_email?: string | null
          id?: string
          positioning?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          support_email?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      issue_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          issue_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          issue_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "scan_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          code_skill: string | null
          created_at: string
          display_name: string | null
          id: string
          job_role: string | null
          onboarding_completed: boolean | null
          team_size: string | null
          technicality_level: number | null
          updated_at: string
          user_id: string
          user_type: string | null
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          code_skill?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_role?: string | null
          onboarding_completed?: boolean | null
          team_size?: string | null
          technicality_level?: number | null
          updated_at?: string
          user_id: string
          user_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          code_skill?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_role?: string | null
          onboarding_completed?: boolean | null
          team_size?: string | null
          technicality_level?: number | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_issues: {
        Row: {
          action_taken: string | null
          actual_result: string | null
          affected_urls: string[] | null
          category: string
          console_evidence: Json | null
          created_at: string
          description: string
          evidence_score: number
          expected_result: string | null
          feedback: string | null
          fix_code: string | null
          fix_content: string | null
          fix_dev: string | null
          fix_nocode: string | null
          fix_visual: string | null
          http_status: number | null
          id: string
          impact: string | null
          kind: string
          location: string | null
          network_evidence: Json | null
          priority: string
          reproduction_steps: Json | null
          scan_id: string
          screenshot_url: string | null
          source_engine: string
          status: string
          taxonomy: string | null
          theme_key: string | null
          title: string
          user_id: string
          viewport: string | null
        }
        Insert: {
          action_taken?: string | null
          actual_result?: string | null
          affected_urls?: string[] | null
          category?: string
          console_evidence?: Json | null
          created_at?: string
          description: string
          evidence_score?: number
          expected_result?: string | null
          feedback?: string | null
          fix_code?: string | null
          fix_content?: string | null
          fix_dev?: string | null
          fix_nocode?: string | null
          fix_visual?: string | null
          http_status?: number | null
          id?: string
          impact?: string | null
          kind?: string
          location?: string | null
          network_evidence?: Json | null
          priority?: string
          reproduction_steps?: Json | null
          scan_id: string
          screenshot_url?: string | null
          source_engine?: string
          status?: string
          taxonomy?: string | null
          theme_key?: string | null
          title: string
          user_id: string
          viewport?: string | null
        }
        Update: {
          action_taken?: string | null
          actual_result?: string | null
          affected_urls?: string[] | null
          category?: string
          console_evidence?: Json | null
          created_at?: string
          description?: string
          evidence_score?: number
          expected_result?: string | null
          feedback?: string | null
          fix_code?: string | null
          fix_content?: string | null
          fix_dev?: string | null
          fix_nocode?: string | null
          fix_visual?: string | null
          http_status?: number | null
          id?: string
          impact?: string | null
          kind?: string
          location?: string | null
          network_evidence?: Json | null
          priority?: string
          reproduction_steps?: Json | null
          scan_id?: string
          screenshot_url?: string | null
          source_engine?: string
          status?: string
          taxonomy?: string | null
          theme_key?: string | null
          title?: string
          user_id?: string
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_issues_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_jobs: {
        Row: {
          created_at: string
          depth: string
          error_message: string | null
          exclusions: string | null
          finished_at: string | null
          focus_areas: string[]
          forms_policy: string
          id: string
          outcome: string | null
          requested_by: string
          result_summary: Json | null
          scan_id: string | null
          scheduled_scan_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          url: string
          user_id: string
          website_id: string | null
          worker_token_hash: string | null
        }
        Insert: {
          created_at?: string
          depth?: string
          error_message?: string | null
          exclusions?: string | null
          finished_at?: string | null
          focus_areas?: string[]
          forms_policy?: string
          id?: string
          outcome?: string | null
          requested_by?: string
          result_summary?: Json | null
          scan_id?: string | null
          scheduled_scan_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          url: string
          user_id: string
          website_id?: string | null
          worker_token_hash?: string | null
        }
        Update: {
          created_at?: string
          depth?: string
          error_message?: string | null
          exclusions?: string | null
          finished_at?: string | null
          focus_areas?: string[]
          forms_policy?: string
          id?: string
          outcome?: string | null
          requested_by?: string
          result_summary?: Json | null
          scan_id?: string | null
          scheduled_scan_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
          website_id?: string | null
          worker_token_hash?: string | null
        }
        Relationships: []
      }
      scan_preferences: {
        Row: {
          created_at: string
          focus_areas: string[] | null
          goals: string[] | null
          growth_mode: string | null
          id: string
          skill_level: string | null
          updated_at: string
          user_id: string
          website_id: string
        }
        Insert: {
          created_at?: string
          focus_areas?: string[] | null
          goals?: string[] | null
          growth_mode?: string | null
          id?: string
          skill_level?: string | null
          updated_at?: string
          user_id: string
          website_id: string
        }
        Update: {
          created_at?: string
          focus_areas?: string[] | null
          goals?: string[] | null
          growth_mode?: string | null
          id?: string
          skill_level?: string | null
          updated_at?: string
          user_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_preferences_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: true
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          ai_summary: string | null
          brand_analysis: Json | null
          crawl_report: Json | null
          created_at: string
          health_score: number | null
          id: string
          media_analysis: Json | null
          scan_type: string
          security_score: number | null
          sentiment_score: number | null
          status: string
          updated_at: string
          url: string
          user_id: string
          website_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          brand_analysis?: Json | null
          crawl_report?: Json | null
          created_at?: string
          health_score?: number | null
          id?: string
          media_analysis?: Json | null
          scan_type?: string
          security_score?: number | null
          sentiment_score?: number | null
          status?: string
          updated_at?: string
          url: string
          user_id: string
          website_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          brand_analysis?: Json | null
          crawl_report?: Json | null
          created_at?: string
          health_score?: number | null
          id?: string
          media_analysis?: Json | null
          scan_type?: string
          security_score?: number | null
          sentiment_score?: number | null
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_scans: {
        Row: {
          alert_threshold: string
          created_at: string
          depth: string
          exclusions: string | null
          focus_areas: string[]
          forms_policy: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string
          outcome: string | null
          scan_type: string
          scheduled_days: string[] | null
          scheduled_time: string
          timezone: string
          updated_at: string
          user_id: string
          website_id: string
        }
        Insert: {
          alert_threshold?: string
          created_at?: string
          depth?: string
          exclusions?: string | null
          focus_areas?: string[]
          forms_policy?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at: string
          outcome?: string | null
          scan_type?: string
          scheduled_days?: string[] | null
          scheduled_time: string
          timezone?: string
          updated_at?: string
          user_id: string
          website_id: string
        }
        Update: {
          alert_threshold?: string
          created_at?: string
          depth?: string
          exclusions?: string | null
          focus_areas?: string[]
          forms_policy?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string
          outcome?: string | null
          scan_type?: string
          scheduled_days?: string[] | null
          scheduled_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          website_id?: string
        }
        Relationships: []
      }
      user_seen_versions: {
        Row: {
          id: string
          seen_at: string
          user_id: string
          version_id: string
        }
        Insert: {
          id?: string
          seen_at?: string
          user_id: string
          version_id: string
        }
        Update: {
          id?: string
          seen_at?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_seen_versions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "app_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      website_credentials: {
        Row: {
          access_scope: string | null
          account_type: string | null
          allow_form_submission: boolean | null
          allow_test_actions: boolean | null
          block_destructive: boolean | null
          created_at: string
          id: string
          login_type: string | null
          login_url: string | null
          non_invasive_only: boolean
          notes: string | null
          permission_granted: boolean
          permission_granted_at: string | null
          pin_or_2fa: string | null
          requires_login: boolean | null
          safe_mode: boolean | null
          test_password: string | null
          test_username: string | null
          updated_at: string
          user_id: string
          website_id: string
        }
        Insert: {
          access_scope?: string | null
          account_type?: string | null
          allow_form_submission?: boolean | null
          allow_test_actions?: boolean | null
          block_destructive?: boolean | null
          created_at?: string
          id?: string
          login_type?: string | null
          login_url?: string | null
          non_invasive_only?: boolean
          notes?: string | null
          permission_granted?: boolean
          permission_granted_at?: string | null
          pin_or_2fa?: string | null
          requires_login?: boolean | null
          safe_mode?: boolean | null
          test_password?: string | null
          test_username?: string | null
          updated_at?: string
          user_id: string
          website_id: string
        }
        Update: {
          access_scope?: string | null
          account_type?: string | null
          allow_form_submission?: boolean | null
          allow_test_actions?: boolean | null
          block_destructive?: boolean | null
          created_at?: string
          id?: string
          login_type?: string | null
          login_url?: string | null
          non_invasive_only?: boolean
          notes?: string | null
          permission_granted?: boolean
          permission_granted_at?: string | null
          pin_or_2fa?: string | null
          requires_login?: boolean | null
          safe_mode?: boolean | null
          test_password?: string | null
          test_username?: string | null
          updated_at?: string
          user_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_credentials_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: true
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          created_at: string
          github_repo_url: string | null
          id: string
          name: string | null
          section: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          github_repo_url?: string | null
          id?: string
          name?: string | null
          section?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          github_repo_url?: string | null
          id?: string
          name?: string | null
          section?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          company_code: string
          company_name: string
          created_at: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          company_code: string
          company_name: string
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          company_code?: string
          company_name?: string
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_company_code: { Args: never; Returns: string }
      get_user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
      join_workspace_by_code: { Args: { _code: string }; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
