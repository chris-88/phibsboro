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
      events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string
          notes: string | null
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
          id?: string
          location: string
          notes?: string | null
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
          id?: string
          location?: string
          notes?: string | null
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
            foreignKeyName: 'events_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          name: string
          phone: string
        }
        Update: {
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
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
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
      [_ in never]: never
    }
    Enums: {
      availability_response: 'available' | 'unavailable'
      event_status: 'scheduled' | 'cancelled'
      event_type: 'training' | 'match'
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
      event_type: ['training', 'match'],
      member_role: ['player', 'manager'],
    },
  },
} as const
