// Generated from the Supabase schema (supabase gen types / MCP generate_typescript_types). Do not edit.
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
      announcement_acks: {
        Row: {
          acked_at: string
          announcement_id: string
          user_id: string
        }
        Insert: {
          acked_at?: string
          announcement_id: string
          user_id?: string
        }
        Update: {
          acked_at?: string
          announcement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_acks_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_acks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audiences: Database["public"]["Enums"]["participant_category"][]
          body: string | null
          created_at: string
          created_by: string | null
          critical: boolean
          edition_id: string
          id: string
          published_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          body?: string | null
          created_at?: string
          created_by?: string | null
          critical?: boolean
          edition_id: string
          id?: string
          published_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          body?: string | null
          created_at?: string
          created_by?: string | null
          critical?: boolean
          edition_id?: string
          id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "announcements_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_assignments: {
        Row: {
          carer_id: string
          created_at: string
          edition_id: string
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["care_kind"]
          malade_id: string
          note: string | null
          starts_at: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          carer_id: string
          created_at?: string
          edition_id: string
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["care_kind"]
          malade_id: string
          note?: string | null
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          carer_id?: string
          created_at?: string
          edition_id?: string
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["care_kind"]
          malade_id?: string
          note?: string | null
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "care_assignments_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assignments_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assignments_malade_id_fkey"
            columns: ["malade_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          audiences: Database["public"]["Enums"]["participant_category"][]
          created_at: string
          edition_id: string
          id: string
          is_emergency: boolean
          label: string
          name: string | null
          phone: string | null
          sort: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          created_at?: string
          edition_id: string
          id?: string
          is_emergency?: boolean
          label: string
          name?: string | null
          phone?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          created_at?: string
          edition_id?: string
          id?: string
          is_emergency?: boolean
          label?: string
          name?: string | null
          phone?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contacts_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          edition_id: string
          id: string
          issued_at: string
          issued_by: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          participant_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
        }
        Insert: {
          edition_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          kind?: Database["public"]["Enums"]["credential_kind"]
          participant_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
        }
        Update: {
          edition_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          kind?: Database["public"]["Enums"]["credential_kind"]
          participant_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      duties: {
        Row: {
          created_at: string
          edition_id: string
          ends_at: string
          id: string
          kind: string | null
          lead_id: string | null
          location: string | null
          needed: number
          note: string | null
          starts_at: string
          team_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          edition_id: string
          ends_at: string
          id?: string
          kind?: string | null
          lead_id?: string | null
          location?: string | null
          needed?: number
          note?: string | null
          starts_at: string
          team_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          edition_id?: string
          ends_at?: string
          id?: string
          kind?: string | null
          lead_id?: string | null
          location?: string | null
          needed?: number
          note?: string | null
          starts_at?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "duties_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duties_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duties_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_assignments: {
        Row: {
          duty_id: string
          edition_id: string
          id: string
          participant_id: string
        }
        Insert: {
          duty_id: string
          edition_id: string
          id?: string
          participant_id: string
        }
        Update: {
          duty_id?: string
          edition_id?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_assignments_duty_id_fkey"
            columns: ["duty_id"]
            isOneToOne: false
            referencedRelation: "duties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          badge_config: Json
          created_at: string
          emergency_phone: string | null
          ends_on: string
          id: string
          starts_on: string
          status: Database["public"]["Enums"]["edition_status"]
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          year: number
        }
        Insert: {
          badge_config?: Json
          created_at?: string
          emergency_phone?: string | null
          ends_on: string
          id?: string
          starts_on: string
          status?: Database["public"]["Enums"]["edition_status"]
          timezone?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          year: number
        }
        Update: {
          badge_config?: Json
          created_at?: string
          emergency_phone?: string | null
          ends_on?: string
          id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["edition_status"]
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          year?: number
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          edition_id: string
          id: string
          name: string
          participant_id: string
          phone: string
          relation: string | null
          sort: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          edition_id: string
          id?: string
          name: string
          participant_id: string
          phone: string
          relation?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          edition_id?: string
          id?: string
          name?: string
          participant_id?: string
          phone?: string
          relation?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_contacts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          audiences: Database["public"]["Enums"]["participant_category"][]
          created_at: string
          description: string | null
          edition_id: string
          ends_at: string | null
          id: string
          location: string | null
          place_id: string | null
          starts_at: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          created_at?: string
          description?: string | null
          edition_id: string
          ends_at?: string | null
          id?: string
          location?: string | null
          place_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          created_at?: string
          description?: string | null
          edition_id?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          place_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address: string | null
          colour: string | null
          created_at: string
          edition_id: string
          id: string
          kind: Database["public"]["Enums"]["facility_kind"]
          lat: number | null
          lng: number | null
          name: string
          note: string | null
          phone: string | null
          short_label: string | null
          sort: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          address?: string | null
          colour?: string | null
          created_at?: string
          edition_id: string
          id?: string
          kind?: Database["public"]["Enums"]["facility_kind"]
          lat?: number | null
          lng?: number | null
          name: string
          note?: string | null
          phone?: string | null
          short_label?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          address?: string | null
          colour?: string | null
          created_at?: string
          edition_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["facility_kind"]
          lat?: number | null
          lng?: number | null
          name?: string
          note?: string | null
          phone?: string | null
          short_label?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "facilities_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_pages: {
        Row: {
          audiences: Database["public"]["Enums"]["participant_category"][]
          body: string
          created_at: string
          edition_id: string | null
          id: string
          language: string
          slug: string
          sort: number
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          body?: string
          created_at?: string
          edition_id?: string | null
          id?: string
          language?: string
          slug: string
          sort?: number
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          audiences?: Database["public"]["Enums"]["participant_category"][]
          body?: string
          created_at?: string
          edition_id?: string | null
          id?: string
          language?: string
          slug?: string
          sort?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_pages_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigned_to: string | null
          created_at: string
          edition_id: string
          id: string
          kind: Database["public"]["Enums"]["incident_kind"]
          location: string | null
          participant_id: string | null
          reported_by: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          summary: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          edition_id: string
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind"]
          location?: string | null
          participant_id?: string | null
          reported_by?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          summary: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          edition_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind"]
          location?: string | null
          participant_id?: string | null
          reported_by?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      leg_assignments: {
        Row: {
          arrived_at: string | null
          arrived_by: string | null
          boarded_at: string | null
          boarded_by: string | null
          created_at: string
          edition_id: string
          id: string
          leg_id: string
          note: string | null
          participant_id: string
          seat: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          arrived_at?: string | null
          arrived_by?: string | null
          boarded_at?: string | null
          boarded_by?: string | null
          created_at?: string
          edition_id: string
          id?: string
          leg_id: string
          note?: string | null
          participant_id: string
          seat?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          arrived_at?: string | null
          arrived_by?: string | null
          boarded_at?: string | null
          boarded_by?: string | null
          created_at?: string
          edition_id?: string
          id?: string
          leg_id?: string
          note?: string | null
          participant_id?: string
          seat?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "leg_assignments_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_assignments_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "transport_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          access_code: string | null
          category: Database["public"]["Enums"]["participant_category"]
          created_at: string
          edition_id: string
          email: string | null
          first_name: string
          id: string
          language: string
          last_name: string
          logistics_note: string | null
          mobility: Database["public"]["Enums"]["mobility"]
          phone: string | null
          photo_path: string | null
          preferred_name: string | null
          staff_note: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          version: number
        }
        Insert: {
          access_code?: string | null
          category: Database["public"]["Enums"]["participant_category"]
          created_at?: string
          edition_id: string
          email?: string | null
          first_name: string
          id?: string
          language?: string
          last_name: string
          logistics_note?: string | null
          mobility?: Database["public"]["Enums"]["mobility"]
          phone?: string | null
          photo_path?: string | null
          preferred_name?: string | null
          staff_note?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          version?: number
        }
        Update: {
          access_code?: string | null
          category?: Database["public"]["Enums"]["participant_category"]
          created_at?: string
          edition_id?: string
          email?: string | null
          first_name?: string
          id?: string
          language?: string
          last_name?: string
          logistics_note?: string | null
          mobility?: Database["public"]["Enums"]["mobility"]
          phone?: string | null
          photo_path?: string | null
          preferred_name?: string | null
          staff_note?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "participants_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          accessibility: string | null
          created_at: string
          description: string | null
          directions: string | null
          edition_id: string | null
          id: string
          kind: string | null
          lat: number | null
          lng: number | null
          photo_credit: string | null
          photo_source: string | null
          photo_url: string | null
          name: string
          sort: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          accessibility?: string | null
          created_at?: string
          description?: string | null
          directions?: string | null
          edition_id?: string | null
          id?: string
          kind?: string | null
          lat?: number | null
          lng?: number | null
          photo_credit?: string | null
          photo_source?: string | null
          photo_url?: string | null
          name: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          accessibility?: string | null
          created_at?: string
          description?: string | null
          directions?: string | null
          edition_id?: string | null
          id?: string
          kind?: string | null
          lat?: number | null
          lng?: number | null
          photo_credit?: string | null
          photo_source?: string | null
          photo_url?: string | null
          name?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "places_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_super_admin: boolean
          staff_code_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_super_admin?: boolean
          staff_code_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_super_admin?: boolean
          staff_code_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_staff_code_id_fkey"
            columns: ["staff_code_id"]
            isOneToOne: false
            referencedRelation: "staff_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      role_grants: {
        Row: {
          edition_id: string
          granted_at: string
          granted_by: string | null
          id: string
          participant_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string | null
        }
        Insert: {
          edition_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          participant_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Update: {
          edition_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          participant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_grants_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_assignments: {
        Row: {
          bed: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          edition_id: string
          id: string
          participant_id: string
          room_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          bed?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          edition_id: string
          id?: string
          participant_id: string
          room_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          bed?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          edition_id?: string
          id?: string
          participant_id?: string
          room_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          edition_id: string
          facility_id: string
          floor: string | null
          id: string
          note: string | null
          number: string
          responsible_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          zone: string | null
        }
        Insert: {
          capacity: number
          created_at?: string
          edition_id: string
          facility_id: string
          floor?: string | null
          id?: string
          note?: string | null
          number: string
          responsible_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          zone?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          edition_id?: string
          facility_id?: string
          floor?: string | null
          id?: string
          note?: string | null
          number?: string
          responsible_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          action: Database["public"]["Enums"]["scan_action"]
          client_scan_id: string | null
          credential_id: string | null
          edition_id: string
          id: string
          leg_id: string | null
          participant_id: string | null
          result: string
          scanned_at: string
          scanned_by: string
        }
        Insert: {
          action: Database["public"]["Enums"]["scan_action"]
          client_scan_id?: string | null
          credential_id?: string | null
          edition_id: string
          id?: string
          leg_id?: string | null
          participant_id?: string | null
          result: string
          scanned_at?: string
          scanned_by?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["scan_action"]
          client_scan_id?: string | null
          credential_id?: string | null
          edition_id?: string
          id?: string
          leg_id?: string | null
          participant_id?: string | null
          result?: string
          scanned_at?: string
          scanned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "transport_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          edition_id: string
          id: string
          label: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          edition_id: string
          id?: string
          label?: string | null
          valid_from?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          edition_id?: string
          id?: string
          label?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_codes_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          edition_id: string
          id: string
          participant_id: string
          team_id: string
        }
        Insert: {
          edition_id: string
          id?: string
          participant_id: string
          team_id: string
        }
        Update: {
          edition_id?: string
          id?: string
          participant_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          edition_id: string
          id: string
          leader_id: string | null
          name: string
          note: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          edition_id: string
          id?: string
          leader_id?: string | null
          name: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          edition_id?: string
          id?: string
          leader_id?: string | null
          name?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_legs: {
        Row: {
          arrives_at: string | null
          capacity: number | null
          code: string
          created_at: string
          departs_at: string | null
          destination: string | null
          direction: Database["public"]["Enums"]["leg_direction"]
          edition_id: string
          facility_id: string | null
          id: string
          kind: Database["public"]["Enums"]["leg_kind"]
          label: string | null
          meeting_at: string | null
          meeting_point: string | null
          note: string | null
          origin: string | null
          responsible_id: string | null
          sort: number
          updated_at: string
          updated_by: string | null
          version: number
          wheelchair_capacity: number
        }
        Insert: {
          arrives_at?: string | null
          capacity?: number | null
          code: string
          created_at?: string
          departs_at?: string | null
          destination?: string | null
          direction: Database["public"]["Enums"]["leg_direction"]
          edition_id: string
          facility_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["leg_kind"]
          label?: string | null
          meeting_at?: string | null
          meeting_point?: string | null
          note?: string | null
          origin?: string | null
          responsible_id?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          wheelchair_capacity?: number
        }
        Update: {
          arrives_at?: string | null
          capacity?: number | null
          code?: string
          created_at?: string
          departs_at?: string | null
          destination?: string | null
          direction?: Database["public"]["Enums"]["leg_direction"]
          edition_id?: string
          facility_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["leg_kind"]
          label?: string | null
          meeting_at?: string | null
          meeting_point?: string | null
          note?: string | null
          origin?: string | null
          responsible_id?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          wheelchair_capacity?: number
        }
        Relationships: [
          {
            foreignKeyName: "transport_legs_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_legs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_legs_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      code_login_check: {
        Args: { p_code: string; p_ip: string; p_staff_code: string }
        Returns: Json
      }
      code_login_link: {
        Args: { p_participant: string; p_staff_code: string; p_user: string }
        Returns: undefined
      }
      issue_credential: {
        Args: {
          p_kind?: Database["public"]["Enums"]["credential_kind"]
          p_participant: string
        }
        Returns: string
      }
      my_digital_credential: { Args: { p_edition?: string }; Returns: string }
      my_pilgrimage: { Args: { p_edition?: string }; Returns: Json }
      participant_card: { Args: { p_participant: string }; Returns: Json }
      revoke_credential: {
        Args: { p_participant: string; p_reason?: string }
        Returns: undefined
      }
      scan_badge: {
        Args: {
          p_action?: Database["public"]["Enums"]["scan_action"]
          p_client_scan_id?: string
          p_leg?: string
          p_payload: string
        }
        Returns: Json
      }
      set_account_status: {
        Args: { p_participant: string; p_status: string }
        Returns: undefined
      }
      staff_action: {
        Args: {
          p_action: Database["public"]["Enums"]["scan_action"]
          p_client_scan_id?: string
          p_leg?: string
          p_participant: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "organizer" | "medical" | "staff" | "assistant"
      care_kind: "primary" | "backup" | "temporary"
      credential_kind: "card" | "digital"
      edition_status: "draft" | "active" | "archived"
      facility_kind: "hotel" | "care" | "other"
      incident_kind:
        | "operational"
        | "care"
        | "medical"
        | "missing_person"
        | "other"
      incident_severity: "low" | "normal" | "high" | "critical"
      incident_status: "open" | "in_progress" | "resolved"
      leg_direction: "outbound" | "return" | "local"
      leg_kind: "flight" | "bus" | "truck" | "other"
      mobility: "walks" | "assisted" | "wheelchair"
      participant_category: "staff" | "malade" | "assistant" | "pilgrim"
      scan_action: "lookup" | "board" | "arrive" | "check_in"
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
      app_role: ["organizer", "medical", "staff", "assistant"],
      care_kind: ["primary", "backup", "temporary"],
      credential_kind: ["card", "digital"],
      edition_status: ["draft", "active", "archived"],
      facility_kind: ["hotel", "care", "other"],
      incident_kind: [
        "operational",
        "care",
        "medical",
        "missing_person",
        "other",
      ],
      incident_severity: ["low", "normal", "high", "critical"],
      incident_status: ["open", "in_progress", "resolved"],
      leg_direction: ["outbound", "return", "local"],
      leg_kind: ["flight", "bus", "truck", "other"],
      mobility: ["walks", "assisted", "wheelchair"],
      participant_category: ["staff", "malade", "assistant", "pilgrim"],
      scan_action: ["lookup", "board", "arrive", "check_in"],
    },
  },
} as const
