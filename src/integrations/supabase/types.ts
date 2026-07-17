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
  public: {
    Tables: {
      action_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message_sanitized: string | null
          id: string
          idempotency_key: string
          organization_id: string
          proposal_id: string
          rollback_reference: string | null
          sanitized_arguments: Json
          sanitized_result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["execution_status"]
          tool_name: string
          verification_status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message_sanitized?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          proposal_id: string
          rollback_reference?: string | null
          sanitized_arguments?: Json
          sanitized_result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          tool_name: string
          verification_status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message_sanitized?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          proposal_id?: string
          rollback_reference?: string | null
          sanitized_arguments?: Json
          sanitized_result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          tool_name?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_executions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "action_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      action_proposals: {
        Row: {
          action_type: string
          ad_account_asset_id: string | null
          created_at: string
          created_by_agent: string | null
          current_state: Json | null
          diff: Json | null
          estimated_impact: string | null
          expires_at: string | null
          explanation: string | null
          id: string
          organization_id: string
          proposed_arguments: Json
          proposed_state: Json | null
          rationale: string | null
          requested_by_user_id: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          status: Database["public"]["Enums"]["proposal_status"]
          title: string
          tool_name: string
          updated_at: string
        }
        Insert: {
          action_type: string
          ad_account_asset_id?: string | null
          created_at?: string
          created_by_agent?: string | null
          current_state?: Json | null
          diff?: Json | null
          estimated_impact?: string | null
          expires_at?: string | null
          explanation?: string | null
          id?: string
          organization_id: string
          proposed_arguments?: Json
          proposed_state?: Json | null
          rationale?: string | null
          requested_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["proposal_status"]
          title: string
          tool_name: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          ad_account_asset_id?: string | null
          created_at?: string
          created_by_agent?: string | null
          current_state?: Json | null
          diff?: Json | null
          estimated_impact?: string | null
          expires_at?: string | null
          explanation?: string | null
          id?: string
          organization_id?: string
          proposed_arguments?: Json
          proposed_state?: Json | null
          rationale?: string | null
          requested_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["proposal_status"]
          title?: string
          tool_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_proposals_ad_account_asset_id_fkey"
            columns: ["ad_account_asset_id"]
            isOneToOne: false
            referencedRelation: "meta_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          agent_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          organization_id: string
          sanitized_metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          agent_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          sanitized_metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          agent_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          sanitized_metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_campaign_links: {
        Row: {
          adset_external_id: string | null
          adset_name: string | null
          campaign_external_id: string
          campaign_name: string | null
          created_at: string
          created_by: string | null
          creative_id: string
          id: string
          meta_ad_id: string | null
          meta_creative_id: string | null
          organization_id: string
          publication_error: string | null
          publication_status: string
          updated_at: string
        }
        Insert: {
          adset_external_id?: string | null
          adset_name?: string | null
          campaign_external_id: string
          campaign_name?: string | null
          created_at?: string
          created_by?: string | null
          creative_id: string
          id?: string
          meta_ad_id?: string | null
          meta_creative_id?: string | null
          organization_id: string
          publication_error?: string | null
          publication_status?: string
          updated_at?: string
        }
        Update: {
          adset_external_id?: string | null
          adset_name?: string | null
          campaign_external_id?: string
          campaign_name?: string | null
          created_at?: string
          created_by?: string | null
          creative_id?: string
          id?: string
          meta_ad_id?: string | null
          meta_creative_id?: string | null
          organization_id?: string
          publication_error?: string | null
          publication_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_campaign_links_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_campaign_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          active_ads_count: number
          ads_count: number
          archived_at: string | null
          created_at: string
          created_by_ai: boolean
          created_by_user_id: string | null
          cta: string | null
          description: string | null
          destination_url: string | null
          file_size: number | null
          format: string | null
          headline: string | null
          height: number | null
          id: string
          in_use: boolean
          last_synced_at: string | null
          media_url: string | null
          meta_ad_account_id: string | null
          meta_creative_id: string | null
          meta_payload: Json
          mime_type: string | null
          name: string
          object_type: string | null
          organization_id: string
          performance: Json
          primary_text: string | null
          publication_status: string
          source: Database["public"]["Enums"]["creative_source"]
          status: string | null
          storage_path: string | null
          tags: string[]
          thumbnail_url: string | null
          type: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          active_ads_count?: number
          ads_count?: number
          archived_at?: string | null
          created_at?: string
          created_by_ai?: boolean
          created_by_user_id?: string | null
          cta?: string | null
          description?: string | null
          destination_url?: string | null
          file_size?: number | null
          format?: string | null
          headline?: string | null
          height?: number | null
          id?: string
          in_use?: boolean
          last_synced_at?: string | null
          media_url?: string | null
          meta_ad_account_id?: string | null
          meta_creative_id?: string | null
          meta_payload?: Json
          mime_type?: string | null
          name: string
          object_type?: string | null
          organization_id: string
          performance?: Json
          primary_text?: string | null
          publication_status?: string
          source?: Database["public"]["Enums"]["creative_source"]
          status?: string | null
          storage_path?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          active_ads_count?: number
          ads_count?: number
          archived_at?: string | null
          created_at?: string
          created_by_ai?: boolean
          created_by_user_id?: string | null
          cta?: string | null
          description?: string | null
          destination_url?: string | null
          file_size?: number | null
          format?: string | null
          headline?: string | null
          height?: number | null
          id?: string
          in_use?: boolean
          last_synced_at?: string | null
          media_url?: string | null
          meta_ad_account_id?: string | null
          meta_creative_id?: string | null
          meta_payload?: Json
          mime_type?: string | null
          name?: string
          object_type?: string | null
          organization_id?: string
          performance?: Json
          primary_text?: string | null
          publication_status?: string
          source?: Database["public"]["Enums"]["creative_source"]
          status?: string | null
          storage_path?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_sessions: {
        Row: {
          connection_id: string
          created_at: string
          encrypted_session_reference: string | null
          expires_at: string | null
          id: string
          initialized_at: string | null
          last_activity_at: string | null
          organization_id: string
          protocol_version: string | null
          status: Database["public"]["Enums"]["mcp_session_status"]
        }
        Insert: {
          connection_id: string
          created_at?: string
          encrypted_session_reference?: string | null
          expires_at?: string | null
          id?: string
          initialized_at?: string | null
          last_activity_at?: string | null
          organization_id: string
          protocol_version?: string | null
          status?: Database["public"]["Enums"]["mcp_session_status"]
        }
        Update: {
          connection_id?: string
          created_at?: string
          encrypted_session_reference?: string | null
          expires_at?: string | null
          id?: string
          initialized_at?: string | null
          last_activity_at?: string | null
          organization_id?: string
          protocol_version?: string | null
          status?: Database["public"]["Enums"]["mcp_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mcp_sessions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_sessions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tool_catalog: {
        Row: {
          description: string | null
          enabled: boolean
          first_seen_at: string
          id: string
          input_schema: Json
          last_seen_at: string
          provider: string
          requires_approval: boolean
          risk_level: Database["public"]["Enums"]["risk_level"]
          schema_hash: string
          server_identifier: string
          tool_name: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          first_seen_at?: string
          id?: string
          input_schema?: Json
          last_seen_at?: string
          provider?: string
          requires_approval?: boolean
          risk_level?: Database["public"]["Enums"]["risk_level"]
          schema_hash: string
          server_identifier: string
          tool_name: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          first_seen_at?: string
          id?: string
          input_schema?: Json
          last_seen_at?: string
          provider?: string
          requires_approval?: boolean
          risk_level?: Database["public"]["Enums"]["risk_level"]
          schema_hash?: string
          server_identifier?: string
          tool_name?: string
        }
        Relationships: []
      }
      meta_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["meta_asset_type"]
          connection_id: string
          created_at: string
          currency: string | null
          external_id: string
          id: string
          last_synced_at: string | null
          metadata_sanitized: Json
          name: string | null
          organization_id: string
          selected: boolean
          status: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["meta_asset_type"]
          connection_id: string
          created_at?: string
          currency?: string | null
          external_id: string
          id?: string
          last_synced_at?: string | null
          metadata_sanitized?: Json
          name?: string | null
          organization_id: string
          selected?: boolean
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["meta_asset_type"]
          connection_id?: string
          created_at?: string
          currency?: string | null
          external_id?: string
          id?: string
          last_synced_at?: string | null
          metadata_sanitized?: Json
          name?: string | null
          organization_id?: string
          selected?: boolean
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_assets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_assets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          connected_by_user_id: string
          created_at: string
          display_name: string | null
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          external_user_id: string | null
          granted_scopes: string[]
          id: string
          last_error_code: string | null
          last_error_message_sanitized: string | null
          last_health_check_at: string | null
          last_success_at: string | null
          last_sync_at: string | null
          organization_id: string
          provider: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["meta_connection_status"]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          connected_by_user_id: string
          created_at?: string
          display_name?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          external_user_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error_code?: string | null
          last_error_message_sanitized?: string | null
          last_health_check_at?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          organization_id: string
          provider?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["meta_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          connected_by_user_id?: string
          created_at?: string
          display_name?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          external_user_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error_code?: string | null
          last_error_message_sanitized?: string | null
          last_health_check_at?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          organization_id?: string
          provider?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["meta_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_ai_settings: {
        Row: {
          allow_direct_pause: boolean
          allow_direct_paused_drafts: boolean
          autonomy_level: number
          created_at: string
          image_model: string
          max_budget_change_percent: number
          max_daily_budget_brl: number | null
          organization_id: string
          require_approval_activation: boolean
          require_approval_budget: boolean
          text_model: string
          updated_at: string
          updated_by: string | null
          video_model: string
        }
        Insert: {
          allow_direct_pause?: boolean
          allow_direct_paused_drafts?: boolean
          autonomy_level?: number
          created_at?: string
          image_model?: string
          max_budget_change_percent?: number
          max_daily_budget_brl?: number | null
          organization_id: string
          require_approval_activation?: boolean
          require_approval_budget?: boolean
          text_model?: string
          updated_at?: string
          updated_by?: string | null
          video_model?: string
        }
        Update: {
          allow_direct_pause?: boolean
          allow_direct_paused_drafts?: boolean
          autonomy_level?: number
          created_at?: string
          image_model?: string
          max_budget_change_percent?: number
          max_daily_budget_brl?: number | null
          organization_id?: string
          require_approval_activation?: boolean
          require_approval_budget?: boolean
          text_model?: string
          updated_at?: string
          updated_by?: string | null
          video_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_ai_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_organization_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_organization_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_organization_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_organization_id_fkey"
            columns: ["default_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_preview_requests: {
        Row: {
          answers: Json
          attempts: number
          completed_at: string | null
          created_at: string
          cta: string | null
          device_hash: string
          error_code: string | null
          headline: string | null
          id: string
          ip_hash: string
          primary_text: string | null
          prompt: string | null
          result_url: string | null
          status: string
        }
        Insert: {
          answers?: Json
          attempts?: number
          completed_at?: string | null
          created_at?: string
          cta?: string | null
          device_hash: string
          error_code?: string | null
          headline?: string | null
          id?: string
          ip_hash: string
          primary_text?: string | null
          prompt?: string | null
          result_url?: string | null
          status?: string
        }
        Update: {
          answers?: Json
          attempts?: number
          completed_at?: string | null
          created_at?: string
          cta?: string | null
          device_hash?: string
          error_code?: string | null
          headline?: string | null
          id?: string
          ip_hash?: string
          primary_text?: string | null
          prompt?: string | null
          result_url?: string | null
          status?: string
        }
        Relationships: []
      }
      wizard_waitlist_leads: {
        Row: {
          answers: Json
          created_at: string
          email: string
          id: string
          intent: string
          name: string | null
          source: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          email: string
          id?: string
          intent?: string
          name?: string | null
          source?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          email?: string
          id?: string
          intent?: string
          name?: string | null
          source?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      meta_connections_public: {
        Row: {
          connected_by_user_id: string | null
          created_at: string | null
          display_name: string | null
          external_user_id: string | null
          granted_scopes: string[] | null
          id: string | null
          last_error_code: string | null
          last_error_message_sanitized: string | null
          last_health_check_at: string | null
          last_success_at: string | null
          organization_id: string | null
          provider: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["meta_connection_status"] | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          connected_by_user_id?: string | null
          created_at?: string | null
          display_name?: string | null
          external_user_id?: string | null
          granted_scopes?: string[] | null
          id?: string | null
          last_error_code?: string | null
          last_error_message_sanitized?: string | null
          last_health_check_at?: string | null
          last_success_at?: string | null
          organization_id?: string | null
          provider?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["meta_connection_status"] | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_by_user_id?: string | null
          created_at?: string | null
          display_name?: string | null
          external_user_id?: string | null
          granted_scopes?: string[] | null
          id?: string | null
          last_error_code?: string | null
          last_error_message_sanitized?: string | null
          last_health_check_at?: string | null
          last_success_at?: string | null
          organization_id?: string | null
          provider?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["meta_connection_status"] | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_organization: {
        Args: { _name: string; _slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      has_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "analyst"
        | "creative"
        | "approver"
        | "viewer"
      creative_source: "meta" | "ai" | "upload"
      execution_status:
        | "pending"
        | "running"
        | "succeeded"
        | "failed"
        | "verified"
        | "unverified"
        | "rolled_back"
      mcp_session_status:
        | "initializing"
        | "active"
        | "expired"
        | "failed"
        | "closed"
      meta_asset_type:
        | "business"
        | "ad_account"
        | "page"
        | "instagram_account"
        | "pixel"
        | "catalog"
      meta_connection_status:
        | "pending"
        | "active"
        | "degraded"
        | "reauth_required"
        | "revoked"
        | "error"
      proposal_status:
        | "draft"
        | "awaiting_approval"
        | "approved"
        | "rejected"
        | "expired"
        | "executing"
        | "completed"
        | "failed"
        | "partially_completed"
        | "rolled_back"
      risk_level: "read" | "draft" | "reversible" | "financial" | "destructive"
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
      app_role: [
        "admin",
        "manager",
        "analyst",
        "creative",
        "approver",
        "viewer",
      ],
      creative_source: ["meta", "ai", "upload"],
      execution_status: [
        "pending",
        "running",
        "succeeded",
        "failed",
        "verified",
        "unverified",
        "rolled_back",
      ],
      mcp_session_status: [
        "initializing",
        "active",
        "expired",
        "failed",
        "closed",
      ],
      meta_asset_type: [
        "business",
        "ad_account",
        "page",
        "instagram_account",
        "pixel",
        "catalog",
      ],
      meta_connection_status: [
        "pending",
        "active",
        "degraded",
        "reauth_required",
        "revoked",
        "error",
      ],
      proposal_status: [
        "draft",
        "awaiting_approval",
        "approved",
        "rejected",
        "expired",
        "executing",
        "completed",
        "failed",
        "partially_completed",
        "rolled_back",
      ],
      risk_level: ["read", "draft", "reversible", "financial", "destructive"],
    },
  },
} as const
