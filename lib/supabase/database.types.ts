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
      assets: {
        Row: {
          cache_key: string
          created_at: string
          file_size_bytes: number | null
          id: string
          model_id: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          model_id: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          model_id?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          asset_id: string | null
          asset_url: string | null
          cache_key: string
          created_at: string
          error: string | null
          fal_request_id: string | null
          id: string
          input_prompt: string | null
          input_url: string | null
          kind: string
          product_id: string | null
          status: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          asset_url?: string | null
          cache_key: string
          created_at?: string
          error?: string | null
          fal_request_id?: string | null
          id?: string
          input_prompt?: string | null
          input_url?: string | null
          kind: string
          product_id?: string | null
          status?: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          asset_url?: string | null
          cache_key?: string
          created_at?: string
          error?: string | null
          fal_request_id?: string | null
          id?: string
          input_prompt?: string | null
          input_url?: string | null
          kind?: string
          product_id?: string | null
          status?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          messages_json: Json
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages_json?: Json
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages_json?: Json
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          capture_status: string | null
          created_at: string
          id: string
          net_amount: number | null
          order_id: string
          payee_email: string
          payee_merchant_id: string
          paypal_capture_id: string | null
          product_id: string
          purchase_ref: string
          quantity: number
          retailer: string
          slot: string | null
          title: string
          unit_price: number
          user_id: string
        }
        Insert: {
          capture_status?: string | null
          created_at?: string
          id?: string
          net_amount?: number | null
          order_id: string
          payee_email: string
          payee_merchant_id: string
          paypal_capture_id?: string | null
          product_id: string
          purchase_ref: string
          quantity?: number
          retailer: string
          slot?: string | null
          title: string
          unit_price: number
          user_id: string
        }
        Update: {
          capture_status?: string | null
          created_at?: string
          id?: string
          net_amount?: number | null
          order_id?: string
          payee_email?: string
          payee_merchant_id?: string
          paypal_capture_id?: string | null
          product_id?: string
          purchase_ref?: string
          quantity?: number
          retailer?: string
          slot?: string | null
          title?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          error: string | null
          id: string
          paypal_order_id: string | null
          paypal_payer_email: string | null
          paypal_payer_id: string | null
          status: string
          thread_id: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          paypal_order_id?: string | null
          paypal_payer_email?: string | null
          paypal_payer_id?: string | null
          status?: string
          thread_id?: string | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          paypal_order_id?: string | null
          paypal_payer_email?: string | null
          paypal_payer_id?: string | null
          status?: string
          thread_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      paypal_merchants: {
        Row: {
          created_at: string
          env: string
          payee_email: string
          payee_merchant_id: string
          product_id: string
          retailer: string
        }
        Insert: {
          created_at?: string
          env?: string
          payee_email: string
          payee_merchant_id: string
          product_id: string
          retailer: string
        }
        Update: {
          created_at?: string
          env?: string
          payee_email?: string
          payee_merchant_id?: string
          product_id?: string
          retailer?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          first_prompt: string | null
          id: string
          name: string
          preview_image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_prompt?: string | null
          id?: string
          name: string
          preview_image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          first_prompt?: string | null
          id?: string
          name?: string
          preview_image_url?: string | null
          updated_at?: string
          user_id?: string
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof (DefaultSchema["Enums"] &
        DefaultSchema["CompositeTypes"])
    ? (DefaultSchema["Enums"] & DefaultSchema["CompositeTypes"])[DefaultSchemaEnumNameOrOptions] extends {
        Enums: infer E
      }
      ? E
      : never
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
  : PublicCompositeTypeNameOrOptions extends keyof (DefaultSchema["CompositeTypes"] &
        DefaultSchema["Enums"])
    ? (DefaultSchema["CompositeTypes"] & DefaultSchema["Enums"])[PublicCompositeTypeNameOrOptions] extends {
        CompositeTypes: infer C
      }
      ? C
      : never
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
