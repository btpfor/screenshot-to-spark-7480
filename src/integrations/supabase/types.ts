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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          account_status: string
          address: string | null
          allow_shared_phone: boolean
          birth_date: string | null
          cni_number: string | null
          created_at: string
          driver_type: string
          email: string | null
          first_name: string
          id: string
          join_date: string
          last_login_at: string | null
          last_name: string
          license_expiry: string | null
          license_number: string | null
          matricule: string
          must_change_password: boolean
          notes: string | null
          phone: string
          photo_url: string | null
          platform: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_status?: string
          address?: string | null
          allow_shared_phone?: boolean
          birth_date?: string | null
          cni_number?: string | null
          created_at?: string
          driver_type?: string
          email?: string | null
          first_name: string
          id?: string
          join_date?: string
          last_login_at?: string | null
          last_name: string
          license_expiry?: string | null
          license_number?: string | null
          matricule?: string
          must_change_password?: boolean
          notes?: string | null
          phone: string
          photo_url?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_status?: string
          address?: string | null
          allow_shared_phone?: boolean
          birth_date?: string | null
          cni_number?: string | null
          created_at?: string
          driver_type?: string
          email?: string | null
          first_name?: string
          id?: string
          join_date?: string
          last_login_at?: string | null
          last_name?: string
          license_expiry?: string | null
          license_number?: string | null
          matricule?: string
          must_change_password?: boolean
          notes?: string | null
          phone?: string
          photo_url?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      login_log: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          driver_id: string | null
          id: string
          kind: string
          paid_at: string
          payment_method: string
          period: string | null
          receipt_number: string
          recorded_by: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          driver_id?: string | null
          id?: string
          kind: string
          paid_at?: string
          payment_method?: string
          period?: string | null
          receipt_number?: string
          recorded_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          driver_id?: string | null
          id?: string
          kind?: string
          paid_at?: string
          payment_method?: string
          period?: string | null
          receipt_number?: string
          recorded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
      vehicles: {
        Row: {
          acquisition_date: string | null
          brand: string
          chassis_number: string | null
          color: string | null
          created_at: string
          driver_id: string | null
          fuel_type: string | null
          id: string
          inspection_expiry: string | null
          insurance_expiry: string | null
          model: string
          next_maintenance: string | null
          owner_name: string | null
          plate: string
          status: string
          updated_at: string
          year: number | null
        }
        Insert: {
          acquisition_date?: string | null
          brand: string
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          driver_id?: string | null
          fuel_type?: string | null
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          model: string
          next_maintenance?: string | null
          owner_name?: string | null
          plate: string
          status?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          acquisition_date?: string | null
          brand?: string
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          driver_id?: string | null
          fuel_type?: string | null
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          model?: string
          next_maintenance?: string | null
          owner_name?: string | null
          plate?: string
          status?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_password_changed: { Args: never; Returns: undefined }
      record_login: { Args: never; Returns: undefined }
      update_my_contact: {
        Args: { _address: string; _phone: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "president"
        | "secretaire"
        | "tresorier"
        | "resp_chauffeurs"
        | "resp_parc"
        | "resp_partenariats"
        | "chauffeur"
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
      app_role: [
        "super_admin",
        "president",
        "secretaire",
        "tresorier",
        "resp_chauffeurs",
        "resp_parc",
        "resp_partenariats",
        "chauffeur",
      ],
    },
  },
} as const
