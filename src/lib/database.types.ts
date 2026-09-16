export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          attended: boolean
          event_id: string
          recorded_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attended: boolean
          event_id: string
          recorded_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attended?: boolean
          event_id?: string
          recorded_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      event_responses: {
        Row: {
          event_id: string
          response: Database['public']['Enums']['availability_response']
          updated_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          response: Database['public']['Enums']['availability_response']
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          response?: Database['public']['Enums']['availability_response']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_responses_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_responses_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      event_squad: {
        Row: {
          event_id: string
          is_captain: boolean
          recorded_by: string
          shirt_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          is_captain?: boolean
          recorded_by: string
          shirt_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          is_captain?: boolean
          recorded_by?: string
          shirt_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_squad_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_squad_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_squad_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          home_away: Database['public']['Enums']['home_away'] | null
          id: string
          jersey: Database['public']['Enums']['jersey'] | null
          location: string
          meet_at: string | null
          motm_user_id: string | null
          notes: string | null
          opponent: string | null
          score_them: number | null
          score_us: number | null
          series_id: string | null
          starts_at: string
          status: Database['public']['Enums']['event_status']
          team_id: string
          title: string
          type: Database['public']['Enums']['event_type']
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          home_away?: Database['public']['Enums']['home_away'] | null
          id?: string
          jersey?: Database['public']['Enums']['jersey'] | null
          location: string
          meet_at?: string | null
          motm_user_id?: string | null
          notes?: string | null
          opponent?: string | null
          score_them?: number | null
          score_us?: number | null
          series_id?: string | null
          starts_at: string
          status?: Database['public']['Enums']['event_status']
          team_id: string
          title: string
          type: Database['public']['Enums']['event_type']
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          home_away?: Database['public']['Enums']['home_away'] | null
          id?: string
          jersey?: Database['public']['Enums']['jersey'] | null
          location?: string
          meet_at?: string | null
          motm_user_id?: string | null
          notes?: string | null
          opponent?: string | null
          score_them?: number | null
          score_us?: number | null
          series_id?: string | null
          starts_at?: string
          status?: Database['public']['Enums']['event_status']
          team_id?: string
          title?: string
          type?: Database['public']['Enums']['event_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_motm_user_id_fkey'
            columns: ['motm_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      feedback: {
        Row: {
          category: Database['public']['Enums']['feedback_category']
          context: Json | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database['public']['Enums']['feedback_status']
          user_id: string
        }
        Insert: {
          category?: Database['public']['Enums']['feedback_category']
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database['public']['Enums']['feedback_status']
          user_id: string
        }
        Update: {
          category?: Database['public']['Enums']['feedback_category']
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database['public']['Enums']['feedback_status']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'feedback_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      match_stats: {
        Row: {
          assists: number
          event_id: string
          goals: number
          minutes: number | null
          recorded_by: string | null
          red_card: boolean
          updated_at: string
          user_id: string
          yellow_cards: number
        }
        Insert: {
          assists?: number
          event_id: string
          goals?: number
          minutes?: number | null
          recorded_by?: string | null
          red_card?: boolean
          updated_at?: string
          user_id: string
          yellow_cards?: number
        }
        Update: {
          assists?: number
          event_id?: string
          goals?: number
          minutes?: number | null
          recorded_by?: string | null
          red_card?: boolean
          updated_at?: string
          user_id?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: 'match_stats_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_stats_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_stats_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          id: string
          is_admin: boolean
          name: string
          phone: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          id: string
          is_admin?: boolean
          name: string
          phone: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          name?: string
          phone?: string
        }
        Relationships: []
      }
      reset_tokens: {
        Row: {
          created_by: string | null
          expires_at: string
          id: string
          issued_at: string
          revoked_at: string | null
          team_id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_by?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          revoked_at?: string | null
          team_id: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_by?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          revoked_at?: string | null
          team_id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reset_tokens_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reset_tokens_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reset_tokens_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      team_invites: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          role: Database['public']['Enums']['member_role']
          team_id: string
          token: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          role: Database['public']['Enums']['member_role']
          team_id: string
          token: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          role?: Database['public']['Enums']['member_role']
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_invites_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_invites_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: Database['public']['Enums']['member_role']
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database['public']['Enums']['member_role']
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database['public']['Enums']['member_role']
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          colour: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          colour?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          colour?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_membership: {
        Args: {
          p_role: Database['public']['Enums']['member_role']
          p_team_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      attendance_stats: {
        Args: { p_team_id: string }
        Returns: {
          games_attended: number
          games_total: number
          invited: number
          name: string
          responded: number
          training_attended: number
          training_total: number
          user_id: string
        }[]
      }
      clear_squad: { Args: { p_event_id: string }; Returns: undefined }
      create_team_invite: {
        Args: {
          p_role: Database['public']['Enums']['member_role']
          p_team_id: string
        }
        Returns: string
      }
      event_team_id: { Args: { p_event_id: string }; Returns: string }
      generate_training_series: {
        Args: {
          p_first_starts_at: string
          p_location: string
          p_team_id: string
          p_title: string
          p_weeks: number
        }
        Returns: string[]
      }
      get_event_preview: {
        Args: { p_event_id: string }
        Returns: {
          location: string
          starts_at: string
          status: Database['public']['Enums']['event_status']
          team_id: string
          team_name: string
          title: string
          type: Database['public']['Enums']['event_type']
        }[]
      }
      get_team_invite: {
        Args: {
          p_role: Database['public']['Enums']['member_role']
          p_team_id: string
        }
        Returns: {
          created_at: string
          expires_at: string
          role: Database['public']['Enums']['member_role']
          token: string
        }[]
      }
      has_event_row: { Args: { p_event_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_available_for: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_manager: { Args: { p_team_id: string }; Returns: boolean }
      is_team_member: { Args: { p_team_id: string }; Returns: boolean }
      issue_reset_token: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: string
      }
      join_team_by_event: {
        Args: { p_event_id: string }
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      join_team_by_token: {
        Args: { p_token: string }
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      lookup_team_invite: {
        Args: { p_token: string }
        Returns: {
          role: Database['public']['Enums']['member_role']
          team_id: string
          team_name: string
        }[]
      }
      new_token: { Args: never; Returns: string }
      performance_stats: {
        Args: { p_team_id: string }
        Returns: {
          appearances: number
          assists: number
          goals: number
          minutes: number
          motm: number
          name: string
          red_cards: number
          user_id: string
          yellow_cards: number
        }[]
      }
      redeem_reset_token: {
        Args: { p_new_password: string; p_token: string }
        Returns: string
      }
      remove_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_squad_member: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      resolve_feedback: { Args: { p_id: string }; Returns: undefined }
      revoke_team_invite: {
        Args: {
          p_role: Database['public']['Enums']['member_role']
          p_team_id: string
        }
        Returns: undefined
      }
      set_member_phone: {
        Args: { p_phone: string; p_user_id: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_role: Database['public']['Enums']['member_role']
          p_team_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      set_own_avatar: { Args: { p_path: string }; Returns: undefined }
      set_squad_member: {
        Args: {
          p_event_id: string
          p_is_captain: boolean
          p_shirt_number: number
          p_user_id: string
        }
        Returns: undefined
      }
      team_member_directory: {
        Args: { p_team_id: string }
        Returns: {
          joined_at: string
          name: string
          phone: string
          role: Database['public']['Enums']['member_role']
          user_id: string
        }[]
      }
    }
    Enums: {
      availability_response: 'available' | 'unavailable'
      event_status: 'scheduled' | 'cancelled'
      event_type: 'training' | 'match' | 'social'
      feedback_category: 'bug' | 'idea' | 'other'
      feedback_status: 'open' | 'resolved'
      home_away: 'home' | 'away'
      jersey: 'black' | 'sky' | 'white'
      member_role: 'player' | 'manager'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      availability_response: ['available', 'unavailable'],
      event_status: ['scheduled', 'cancelled'],
      event_type: ['training', 'match', 'social'],
      feedback_category: ['bug', 'idea', 'other'],
      feedback_status: ['open', 'resolved'],
      home_away: ['home', 'away'],
      jersey: ['black', 'sky', 'white'],
      member_role: ['player', 'manager'],
    },
  },
} as const
