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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      armies: {
        Row: {
          created_at: string
          description: string
          faction: string
          id: string
          main_image_path: string | null
          name: string
          owner_id: string
          subfaction: string
        }
        Insert: {
          created_at?: string
          description?: string
          faction: string
          id?: string
          main_image_path?: string | null
          name: string
          owner_id?: string
          subfaction?: string
        }
        Update: {
          created_at?: string
          description?: string
          faction?: string
          id?: string
          main_image_path?: string | null
          name?: string
          owner_id?: string
          subfaction?: string
        }
        Relationships: [
          {
            foreignKeyName: "armies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      army_images: {
        Row: {
          army_id: string
          caption: string
          id: string
          object_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          army_id: string
          caption?: string
          id?: string
          object_path: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Update: {
          army_id?: string
          caption?: string
          id?: string
          object_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "army_images_army_id_fkey"
            columns: ["army_id"]
            isOneToOne: false
            referencedRelation: "armies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "army_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      army_lists: {
        Row: {
          army_id: string
          file_extension: string
          file_name: string
          file_size: number
          id: string
          label: string
          object_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          army_id: string
          file_extension: string
          file_name: string
          file_size: number
          id?: string
          label?: string
          object_path: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Update: {
          army_id?: string
          file_extension?: string
          file_name?: string
          file_size?: number
          id?: string
          label?: string
          object_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "army_lists_army_id_fkey"
            columns: ["army_id"]
            isOneToOne: false
            referencedRelation: "armies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "army_lists_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_images: {
        Row: {
          battle_id: string
          caption: string
          id: string
          object_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          battle_id: string
          caption?: string
          id?: string
          object_path: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Update: {
          battle_id?: string
          caption?: string
          id?: string
          object_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_images_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_participants: {
        Row: {
          army_id: string
          battle_id: string
          id: string
          is_confirmed: boolean
          player_id: string
          result: string
          victory_points: number | null
        }
        Insert: {
          army_id: string
          battle_id: string
          id?: string
          is_confirmed?: boolean
          player_id: string
          result: string
          victory_points?: number | null
        }
        Update: {
          army_id?: string
          battle_id?: string
          id?: string
          is_confirmed?: boolean
          player_id?: string
          result?: string
          victory_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_participants_army_id_fkey"
            columns: ["army_id"]
            isOneToOne: false
            referencedRelation: "armies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_responses: {
        Row: {
          battle_id: string
          player_id: string
          reason: string
          responded_at: string
          response: string
          revision: number
        }
        Insert: {
          battle_id: string
          player_id: string
          reason?: string
          responded_at?: string
          response: string
          revision: number
        }
        Update: {
          battle_id?: string
          player_id?: string
          reason?: string
          responded_at?: string
          response?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_responses_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          battle_date: string
          campaign_id: string
          created_at: string
          description: string
          id: string
          mission: string
          points_limit: number | null
          revision: number
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          battle_date: string
          campaign_id: string
          created_at?: string
          description?: string
          id?: string
          mission: string
          points_limit?: number | null
          revision?: number
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          battle_date?: string
          campaign_id?: string
          created_at?: string
          description?: string
          id?: string
          mission?: string
          points_limit?: number | null
          revision?: number
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "battles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_armies: {
        Row: {
          army_id: string
          campaign_id: string
        }
        Insert: {
          army_id: string
          campaign_id: string
        }
        Update: {
          army_id?: string
          campaign_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_armies_army_id_fkey"
            columns: ["army_id"]
            isOneToOne: false
            referencedRelation: "armies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_armies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          id: string
          is_active: boolean
          joined_at: string
          player_id: string
          role: string
        }
        Insert: {
          campaign_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          player_id: string
          role?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          player_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string
          end_date: string | null
          id: string
          is_published: boolean
          lore: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          end_date?: string | null
          id?: string
          is_published?: boolean
          lore?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          end_date?: string | null
          id?: string
          is_published?: boolean
          lore?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_admins: {
        Row: {
          created_at: string
          player_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_admins_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_log: {
        Row: {
          action: string
          actor_id: string
          battle_id: string | null
          campaign_id: string | null
          created_at: string
          id: string
          reason: string
        }
        Insert: {
          action: string
          actor_id: string
          battle_id?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          reason: string
        }
        Update: {
          action?: string
          actor_id?: string
          battle_id?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_log_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          theme: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          theme?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          theme?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      standings: {
        Row: {
          campaign_id: string | null
          display_name: string | null
          draws: number | null
          losses: number | null
          played: number | null
          player_id: string | null
          points: number | null
          username: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_campaign: { Args: { data: Json }; Returns: string }
      join_campaign: { Args: { cid: string }; Returns: undefined }
      manage_member: {
        Args: { active: boolean; cid: string; new_role: string; pid: string }
        Returns: undefined
      }
      register_army: { Args: { aid: string; cid: string }; Returns: undefined }
      resolve_battle: {
        Args: {
          bid: string
          decision: string
          expected_revision: number
          explanation: string
        }
        Returns: undefined
      }
      respond_battle: {
        Args: {
          answer: string
          bid: string
          expected_revision: number
          explanation?: string
        }
        Returns: undefined
      }
      revise_battle: {
        Args: { bid: string; data: Json; expected_revision: number }
        Returns: undefined
      }
      save_campaign: { Args: { cid: string; data: Json }; Returns: undefined }
      set_global_admin: {
        Args: { enabled: boolean; pid: string }
        Returns: undefined
      }
      submit_battle: { Args: { cid: string; data: Json }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
