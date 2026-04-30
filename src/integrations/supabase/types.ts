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
      bookings: {
        Row: {
          created_at: string
          from_stop_index: number
          id: string
          passenger_name: string
          passenger_phone: string
          seats_booked: number
          segment_price: number
          status: Database["public"]["Enums"]["booking_status"]
          to_stop_index: number
          traveler_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_stop_index: number
          id?: string
          passenger_name: string
          passenger_phone: string
          seats_booked: number
          segment_price: number
          status?: Database["public"]["Enums"]["booking_status"]
          to_stop_index: number
          traveler_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_stop_index?: number
          id?: string
          passenger_name?: string
          passenger_phone?: string
          seats_booked?: number
          segment_price?: number
          status?: Database["public"]["Enums"]["booking_status"]
          to_stop_index?: number
          traveler_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          id: string
          max_price_per_km: number
          min_price_per_km: number
          route_match_tolerance_km: number
          updated_at: string
        }
        Insert: {
          id?: string
          max_price_per_km?: number
          min_price_per_km?: number
          route_match_tolerance_km?: number
          updated_at?: string
        }
        Update: {
          id?: string
          max_price_per_km?: number
          min_price_per_km?: number
          route_match_tolerance_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          host_rating: number | null
          id: string
          phone: string | null
          total_trips_hosted: number
          total_trips_taken: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          host_rating?: number | null
          id: string
          phone?: string | null
          total_trips_hosted?: number
          total_trips_taken?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          host_rating?: number | null
          id?: string
          phone?: string | null
          total_trips_hosted?: number
          total_trips_taken?: number
          updated_at?: string
        }
        Relationships: []
      }
      trip_stops: {
        Row: {
          created_at: string
          distance_from_origin_km: number
          id: string
          lat: number
          lng: number
          location: string
          stop_index: number
          stop_type: Database["public"]["Enums"]["stop_type"]
          trip_id: string
        }
        Insert: {
          created_at?: string
          distance_from_origin_km: number
          id?: string
          lat: number
          lng: number
          location: string
          stop_index: number
          stop_type?: Database["public"]["Enums"]["stop_type"]
          trip_id: string
        }
        Update: {
          created_at?: string
          distance_from_origin_km?: number
          id?: string
          lat?: number
          lng?: number
          location?: string
          stop_index?: number
          stop_type?: Database["public"]["Enums"]["stop_type"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          departure_at: string
          from_lat: number
          from_lng: number
          from_location: string
          host_id: string
          id: string
          notes: string | null
          polyline: string
          price_per_km: number
          status: Database["public"]["Enums"]["trip_status"]
          to_lat: number
          to_lng: number
          to_location: string
          total_distance_km: number
          total_price: number
          total_seats: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          departure_at: string
          from_lat: number
          from_lng: number
          from_location: string
          host_id: string
          id?: string
          notes?: string | null
          polyline: string
          price_per_km: number
          status?: Database["public"]["Enums"]["trip_status"]
          to_lat: number
          to_lng: number
          to_location: string
          total_distance_km: number
          total_price: number
          total_seats: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          departure_at?: string
          from_lat?: number
          from_lng?: number
          from_location?: string
          host_id?: string
          id?: string
          notes?: string | null
          polyline?: string
          price_per_km?: number
          status?: Database["public"]["Enums"]["trip_status"]
          to_lat?: number
          to_lng?: number
          to_location?: string
          total_distance_km?: number
          total_price?: number
          total_seats?: number
          updated_at?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "host" | "traveler"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      stop_type: "pickup" | "drop" | "both"
      trip_status: "scheduled" | "in_progress" | "completed" | "cancelled"
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
      app_role: ["admin", "host", "traveler"],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      stop_type: ["pickup", "drop", "both"],
      trip_status: ["scheduled", "in_progress", "completed", "cancelled"],
    },
  },
} as const
