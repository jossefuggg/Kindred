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
      ai_budget: {
        Row: {
          cap_usd: number
          day: string
          reserved_usd: number
          spent_usd: number
        }
        Insert: {
          cap_usd?: number
          day?: string
          reserved_usd?: number
          spent_usd?: number
        }
        Update: {
          cap_usd?: number
          day?: string
          reserved_usd?: number
          spent_usd?: number
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          cost_usd: number
          created_at: string
          fallback: boolean
          feature: string
          id: number
          reason: string | null
          tokens: number
          user_id: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          fallback?: boolean
          feature: string
          id?: never
          reason?: string | null
          tokens?: number
          user_id?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          fallback?: boolean
          feature?: string
          id?: never
          reason?: string | null
          tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          charity_id: string
          created_at: string
          id: string
          message: string
          status: string
          volunteer_id: string
        }
        Insert: {
          charity_id: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          volunteer_id: string
        }
        Update: {
          charity_id?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: never
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: never
          user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          attended: boolean
          created_at: string
          hours: number
          id: string
          shift_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          hours?: number
          id?: string
          shift_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          hours?: number
          id?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          code: string
          course_id: string
          course_title: string
          expires_at: string
          holder_name: string
          id: string
          issued_at: string
          issuer_name: string
          user_id: string
        }
        Insert: {
          code?: string
          course_id: string
          course_title: string
          expires_at?: string
          holder_name: string
          id?: string
          issued_at?: string
          issuer_name: string
          user_id: string
        }
        Update: {
          code?: string
          course_id?: string
          course_title?: string
          expires_at?: string
          holder_name?: string
          id?: string
          issued_at?: string
          issuer_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      charities: {
        Row: {
          area: string
          cause: string
          created_at: string
          created_by: string | null
          description: string
          founded_year: number | null
          id: string
          image_key: string
          name: string
          website: string
        }
        Insert: {
          area?: string
          cause?: string
          created_at?: string
          created_by?: string | null
          description?: string
          founded_year?: number | null
          id?: string
          image_key?: string
          name: string
          website?: string
        }
        Update: {
          area?: string
          cause?: string
          created_at?: string
          created_by?: string | null
          description?: string
          founded_year?: number | null
          id?: string
          image_key?: string
          name?: string
          website?: string
        }
        Relationships: []
      }
      charity_programs: {
        Row: {
          charity_id: string
          course_id: string
        }
        Insert: {
          charity_id: string
          course_id: string
        }
        Update: {
          charity_id?: string
          course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charity_programs_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charity_programs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          pinned: boolean
          shift_id: string
          user_id: string | null
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          shift_id: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          shift_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          charity_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          minutes: number
          summary: string
          title: string
        }
        Insert: {
          charity_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          minutes?: number
          summary?: string
          title: string
        }
        Update: {
          charity_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          minutes?: number
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
        ]
      }
      endorsements: {
        Row: {
          author_name: string
          body: string
          charity_id: string
          created_at: string
          id: string
          shift_title: string
          volunteer_id: string
        }
        Insert: {
          author_name?: string
          body: string
          charity_id: string
          created_at?: string
          id?: string
          shift_title?: string
          volunteer_id: string
        }
        Update: {
          author_name?: string
          body?: string
          charity_id?: string
          created_at?: string
          id?: string
          shift_title?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "endorsements_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          content?: string
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: Json
          avatar_url: string | null
          bio: string
          causes: string[]
          city: string
          created_at: string
          display_name: string
          headline: string
          id: string
          onboarded: boolean
          skills: string[]
          updated_at: string
        }
        Insert: {
          availability?: Json
          avatar_url?: string | null
          bio?: string
          causes?: string[]
          city?: string
          created_at?: string
          display_name?: string
          headline?: string
          id: string
          onboarded?: boolean
          skills?: string[]
          updated_at?: string
        }
        Update: {
          availability?: Json
          avatar_url?: string | null
          bio?: string
          causes?: string[]
          city?: string
          created_at?: string
          display_name?: string
          headline?: string
          id?: string
          onboarded?: boolean
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          answer_index: number
          course_id: string
          id: string
          options: string[]
          position: number
          q: string
        }
        Insert: {
          answer_index: number
          course_id: string
          id?: string
          options: string[]
          position?: number
          q: string
        }
        Update: {
          answer_index?: number
          course_id?: string
          id?: string
          options?: string[]
          position?: number
          q?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          subject: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          subject: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      shift_requirements: {
        Row: {
          course_id: string
          shift_id: string
        }
        Insert: {
          course_id: string
          shift_id: string
        }
        Update: {
          course_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_requirements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_requirements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          address: string
          cause: string
          charity_id: string
          city: string
          commitment: string
          created_at: string
          description: string
          duration_hours: number
          id: string
          logistics: string
          spots_left: number
          spots_total: number
          starts_at: string
          title: string
        }
        Insert: {
          address?: string
          cause?: string
          charity_id: string
          city?: string
          commitment?: string
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          logistics?: string
          spots_left?: number
          spots_total?: number
          starts_at: string
          title: string
        }
        Update: {
          address?: string
          cause?: string
          charity_id?: string
          city?: string
          commitment?: string
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          logistics?: string
          spots_left?: number
          spots_total?: number
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_charity_id_fkey"
            columns: ["charity_id"]
            isOneToOne: false
            referencedRelation: "charities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      book_shift: { Args: { _shift: string }; Returns: Json }
      cancel_booking: { Args: { _shift: string }; Returns: boolean }
      charity_kpis: { Args: never; Returns: Json }
      charity_public_stats: { Args: { _cid: string }; Returns: Json }
      claim_certificate: {
        Args: { _answers?: number[]; _course: string }
        Returns: Json
      }
      complete_onboarding: {
        Args: {
          _area: string
          _bio: string
          _cause?: string
          _charity_name?: string
          _description?: string
          _name: string
          _role: string
          _website?: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_shift_member: { Args: { _shift: string }; Returns: boolean }
      mark_attendance: {
        Args: { _booking: string; _endorsement: string; _hours: number }
        Returns: undefined
      }
      missing_courses: {
        Args: { _shift: string; _user: string }
        Returns: string[]
      }
      my_charity_id: { Args: never; Returns: string }
      owns_shift: { Args: { _shift: string }; Returns: boolean }
      redact: { Args: { _t: string }; Returns: string }
      reserve_ai_budget: {
        Args: { _amount: number; _share: number }
        Returns: boolean
      }
      send_chat: { Args: { _body: string; _shift: string }; Returns: undefined }
      settle_ai_budget: {
        Args: { _actual: number; _reserved: number }
        Returns: undefined
      }
      volunteer_history: { Args: { _uid: string }; Returns: Json }
      volunteer_stats: { Args: { _uid: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "charity_admin" | "volunteer"
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
    Enums: {
      app_role: ["admin", "charity_admin", "volunteer"],
    },
  },
} as const
