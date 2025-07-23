export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      doctor_incompatibilities: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          incompatible_doctor_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          incompatible_doctor_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          incompatible_doctor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_incompatibilities_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_incompatibilities_incompatible_doctor_id_fkey"
            columns: ["incompatible_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          alias: string
          created_at: string
          full_name: string
          id: string
          max_17h_guards: number | null
          max_7h_guards: number | null
          unavailable_weekdays: number[] | null
          updated_at: string
        }
        Insert: {
          alias: string
          created_at?: string
          full_name: string
          id?: string
          max_17h_guards?: number | null
          max_7h_guards?: number | null
          unavailable_weekdays?: number[] | null
          updated_at?: string
        }
        Update: {
          alias?: string
          created_at?: string
          full_name?: string
          id?: string
          max_17h_guards?: number | null
          max_7h_guards?: number | null
          unavailable_weekdays?: number[] | null
          updated_at?: string
        }
        Relationships: []
      }
      guard_assignments: {
        Row: {
          created_at: string
          date: string
          doctor_id: string
          id: string
          is_original: boolean
          original_doctor_id: string | null
          schedule_id: string
          shift_position: number | null
          shift_type: string
        }
        Insert: {
          created_at?: string
          date: string
          doctor_id: string
          id?: string
          is_original?: boolean
          original_doctor_id?: string | null
          schedule_id: string
          shift_position?: number | null
          shift_type: string
        }
        Update: {
          created_at?: string
          date?: string
          doctor_id?: string
          id?: string
          is_original?: boolean
          original_doctor_id?: string | null
          schedule_id?: string
          shift_position?: number | null
          shift_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_assignments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_assignments_original_doctor_id_fkey"
            columns: ["original_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "guard_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_days: {
        Row: {
          created_at: string
          date: string
          id: string
          is_guard_day: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_guard_day?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_guard_day?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      guard_schedules: {
        Row: {
          approved_at: string | null
          created_at: string
          generated_at: string
          id: string
          month: number
          status: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          month: number
          status?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          month?: number
          status?: string
          year?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          doctor_id: string
          end_date: string
          has_substitute: boolean | null
          id: string
          notes: string | null
          reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          substitute_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          end_date: string
          has_substitute?: boolean | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          substitute_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          end_date?: string
          has_substitute?: boolean | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          substitute_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
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
