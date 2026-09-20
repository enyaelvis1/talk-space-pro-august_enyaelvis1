export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          actor_kind: string;
          changed_fields: string[];
          created_at: string;
          id: string;
          reason: string;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_kind: string;
          changed_fields?: string[];
          created_at?: string;
          id?: string;
          reason: string;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_kind?: string;
          changed_fields?: string[];
          created_at?: string;
          id?: string;
          reason?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      appointment_events: {
        Row: {
          actor_id: string | null;
          appointment_id: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          new_status: Database["public"]["Enums"]["appointment_status"] | null;
          previous_status: Database["public"]["Enums"]["appointment_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          appointment_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          new_status?: Database["public"]["Enums"]["appointment_status"] | null;
          previous_status?: Database["public"]["Enums"]["appointment_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          appointment_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          new_status?: Database["public"]["Enums"]["appointment_status"] | null;
          previous_status?: Database["public"]["Enums"]["appointment_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          archive_reason: string | null;
          archived_at: string | null;
          archived_by: string | null;
          booking_reference: string;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_email: string;
          client_id: string | null;
          client_name: string;
          client_phone: string;
          created_at: string;
          ends_at: string;
          google_event_id: string | null;
          google_meet_url: string | null;
          google_sync_error: string | null;
          google_synced_at: string | null;
          hold_expires_at: string | null;
          id: string;
          manage_token: string | null;
          manage_token_hash: string;
          manage_token_expires_at: string | null;
          manage_token_revoked_at: string | null;
          manage_token_revocation_reason: string | null;
          package_id: string | null;
          notes: string | null;
          paid_amount_kobo: number | null;
          payment_reference: string | null;
          reminder_1h_sent_at: string | null;
          reminder_24h_sent_at: string | null;
          therapist_notification_claimed_at: string | null;
          rescheduled_from_starts_at: string | null;
          service_id: string;
          session_mode: Database["public"]["Enums"]["session_mode"];
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          therapist_id: string;
          updated_at: string;
        };
        Insert: {
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          booking_reference: string;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_email: string;
          client_id?: string | null;
          client_name: string;
          client_phone: string;
          created_at?: string;
          ends_at: string;
          google_event_id?: string | null;
          google_meet_url?: string | null;
          google_sync_error?: string | null;
          google_synced_at?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          manage_token?: string | null;
          manage_token_hash: string;
          manage_token_expires_at?: string | null;
          manage_token_revoked_at?: string | null;
          manage_token_revocation_reason?: string | null;
          package_id?: string | null;
          notes?: string | null;
          paid_amount_kobo?: number | null;
          payment_reference?: string | null;
          reminder_1h_sent_at?: string | null;
          reminder_24h_sent_at?: string | null;
          therapist_notification_claimed_at?: string | null;
          rescheduled_from_starts_at?: string | null;
          service_id: string;
          session_mode: Database["public"]["Enums"]["session_mode"];
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          therapist_id: string;
          updated_at?: string;
        };
        Update: {
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          booking_reference?: string;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_email?: string;
          client_id?: string | null;
          client_name?: string;
          client_phone?: string;
          created_at?: string;
          ends_at?: string;
          google_event_id?: string | null;
          google_meet_url?: string | null;
          google_sync_error?: string | null;
          google_synced_at?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          manage_token?: string | null;
          manage_token_hash?: string;
          manage_token_expires_at?: string | null;
          manage_token_revoked_at?: string | null;
          manage_token_revocation_reason?: string | null;
          package_id?: string | null;
          notes?: string | null;
          paid_amount_kobo?: number | null;
          payment_reference?: string | null;
          reminder_1h_sent_at?: string | null;
          reminder_24h_sent_at?: string | null;
          therapist_notification_claimed_at?: string | null;
          rescheduled_from_starts_at?: string | null;
          service_id?: string;
          session_mode?: Database["public"]["Enums"]["session_mode"];
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          therapist_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_therapist_id_fkey";
            columns: ["therapist_id"];
            isOneToOne: false;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_exceptions: {
        Row: {
          created_at: string;
          ends_at: string;
          external_ref: string | null;
          id: string;
          kind: Database["public"]["Enums"]["availability_exception_kind"];
          mode: Database["public"]["Enums"]["session_mode"] | null;
          reason: string | null;
          source: string;
          starts_at: string;
          therapist_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          external_ref?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["availability_exception_kind"];
          mode?: Database["public"]["Enums"]["session_mode"] | null;
          reason?: string | null;
          source?: string;
          starts_at: string;
          therapist_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          external_ref?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["availability_exception_kind"];
          mode?: Database["public"]["Enums"]["session_mode"] | null;
          reason?: string | null;
          source?: string;
          starts_at?: string;
          therapist_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_therapist_id_fkey";
            columns: ["therapist_id"];
            isOneToOne: false;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_rules: {
        Row: {
          created_at: string;
          day_of_week: number;
          ends_at: string;
          id: string;
          is_active: boolean;
          mode: Database["public"]["Enums"]["session_mode"];
          starts_at: string;
          therapist_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          ends_at: string;
          id?: string;
          is_active?: boolean;
          mode?: Database["public"]["Enums"]["session_mode"];
          starts_at: string;
          therapist_id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          ends_at?: string;
          id?: string;
          is_active?: boolean;
          mode?: Database["public"]["Enums"]["session_mode"];
          starts_at?: string;
          therapist_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_rules_therapist_id_fkey";
            columns: ["therapist_id"];
            isOneToOne: false;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      client_notes: {
        Row: {
          author_id: string | null;
          body: string;
          client_id: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          client_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          assigned_therapist_id: string | null;
          created_at: string;
          date_of_birth: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          occupation: string | null;
          other_names: string | null;
          phone: string | null;
          preferred_mode: Database["public"]["Enums"]["session_mode"] | null;
          record_source: string;
          surname: string | null;
          updated_at: string;
          wedding_anniversary_date: string | null;
        };
        Insert: {
          address?: string | null;
          assigned_therapist_id?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          occupation?: string | null;
          other_names?: string | null;
          phone?: string | null;
          preferred_mode?: Database["public"]["Enums"]["session_mode"] | null;
          record_source?: string;
          surname?: string | null;
          updated_at?: string;
          wedding_anniversary_date?: string | null;
        };
        Update: {
          address?: string | null;
          assigned_therapist_id?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          occupation?: string | null;
          other_names?: string | null;
          phone?: string | null;
          preferred_mode?: Database["public"]["Enums"]["session_mode"] | null;
          record_source?: string;
          surname?: string | null;
          updated_at?: string;
          wedding_anniversary_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_assigned_therapist_id_fkey";
            columns: ["assigned_therapist_id"];
            isOneToOne: false;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_submissions: {
        Row: {
          ack_sent_at: string | null;
          admin_notified_at: string | null;
          created_at: string;
          delivery_error: string | null;
          email: string;
          full_name: string;
          id: string;
          ip_hash: string | null;
          message: string;
          phone: string | null;
          source: string;
        };
        Insert: {
          ack_sent_at?: string | null;
          admin_notified_at?: string | null;
          created_at?: string;
          delivery_error?: string | null;
          email: string;
          full_name: string;
          id?: string;
          ip_hash?: string | null;
          message: string;
          phone?: string | null;
          source?: string;
        };
        Update: {
          ack_sent_at?: string | null;
          admin_notified_at?: string | null;
          created_at?: string;
          delivery_error?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          ip_hash?: string | null;
          message?: string;
          phone?: string | null;
          source?: string;
        };
        Relationships: [];
      };
      content_entries: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          author_name: string | null;
          body_html: string | null;
          canonical_path: string;
          excerpt_html: string | null;
          featured_media_path: string | null;
          id: string;
          imported_at: string;
          kind: Database["public"]["Enums"]["content_entry_kind"];
          metadata: Json;
          published_at: string | null;
          scheduled_publish_at: string | null;
          scheduled_unpublish_at: string | null;
          slug: string;
          source_id: number;
          source_modified_at: string | null;
          source_status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          author_name?: string | null;
          body_html?: string | null;
          canonical_path: string;
          excerpt_html?: string | null;
          featured_media_path?: string | null;
          id?: string;
          imported_at?: string;
          kind: Database["public"]["Enums"]["content_entry_kind"];
          metadata?: Json;
          published_at?: string | null;
          scheduled_publish_at?: string | null;
          scheduled_unpublish_at?: string | null;
          slug: string;
          source_id: number;
          source_modified_at?: string | null;
          source_status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          author_name?: string | null;
          body_html?: string | null;
          canonical_path?: string;
          excerpt_html?: string | null;
          featured_media_path?: string | null;
          id?: string;
          imported_at?: string;
          kind?: Database["public"]["Enums"]["content_entry_kind"];
          metadata?: Json;
          published_at?: string | null;
          scheduled_publish_at?: string | null;
          scheduled_unpublish_at?: string | null;
          slug?: string;
          source_id?: number;
          source_modified_at?: string | null;
          source_status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_entry_media: {
        Row: {
          content_entry_id: string;
          created_at: string;
          media_id: string;
          role: string;
          sort_order: number;
        };
        Insert: {
          content_entry_id: string;
          created_at?: string;
          media_id: string;
          role: string;
          sort_order?: number;
        };
        Update: {
          content_entry_id?: string;
          created_at?: string;
          media_id?: string;
          role?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "content_entry_media_content_entry_id_fkey";
            columns: ["content_entry_id"];
            isOneToOne: false;
            referencedRelation: "content_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_entry_media_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "content_media";
            referencedColumns: ["id"];
          },
        ];
      };
      content_media: {
        Row: {
          alt_text: string | null;
          byte_size: number;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          metadata: Json;
          mime_type: string;
          sha256: string;
          source_filename: string;
          source_hash: string;
          storage_path: string;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          alt_text?: string | null;
          byte_size: number;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          metadata?: Json;
          mime_type: string;
          sha256: string;
          source_filename: string;
          source_hash: string;
          storage_path: string;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          alt_text?: string | null;
          byte_size?: number;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          metadata?: Json;
          mime_type?: string;
          sha256?: string;
          source_filename?: string;
          source_hash?: string;
          storage_path?: string;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      content_revisions: {
        Row: {
          change_type: string;
          changed_by: string | null;
          changed_by_email: string | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          snapshot: Json;
        };
        Insert: {
          change_type: string;
          changed_by?: string | null;
          changed_by_email?: string | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          snapshot: Json;
        };
        Update: {
          change_type?: string;
          changed_by?: string | null;
          changed_by_email?: string | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          snapshot?: Json;
        };
        Relationships: [];
      };
      email_delivery_logs: {
        Row: {
          context: Json | null;
          created_at: string;
          error: string | null;
          id: string;
          next_retry_at: string | null;
          provider_id: string | null;
          reason: string | null;
          recipient: string;
          retried_from: string | null;
          retry_actor_id: string | null;
          retry_count: number;
          retry_payload_ciphertext: string | null;
          retry_trigger: string;
          status: string;
          subject: string | null;
          template_key: string | null;
        };
        Insert: {
          context?: Json | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          next_retry_at?: string | null;
          provider_id?: string | null;
          reason?: string | null;
          recipient: string;
          retried_from?: string | null;
          retry_actor_id?: string | null;
          retry_count?: number;
          retry_payload_ciphertext?: string | null;
          retry_trigger?: string;
          status: string;
          subject?: string | null;
          template_key?: string | null;
        };
        Update: {
          context?: Json | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          next_retry_at?: string | null;
          provider_id?: string | null;
          reason?: string | null;
          recipient?: string;
          retried_from?: string | null;
          retry_actor_id?: string | null;
          retry_count?: number;
          retry_payload_ciphertext?: string | null;
          retry_trigger?: string;
          status?: string;
          subject?: string | null;
          template_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_delivery_logs_retried_from_fkey";
            columns: ["retried_from"];
            isOneToOne: false;
            referencedRelation: "email_delivery_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      email_settings: {
        Row: {
          api_key_ciphertext: string | null;
          api_key_last4: string | null;
          contact_inbox: string | null;
          from_email: string | null;
          from_name: string | null;
          id: number;
          is_enabled: boolean;
          provider: string;
          reply_to: string | null;
          sender_domain: string | null;
          updated_at: string;
          updated_by: string | null;
          zoho_routing_enabled: boolean;
        };
        Insert: {
          api_key_ciphertext?: string | null;
          api_key_last4?: string | null;
          contact_inbox?: string | null;
          from_email?: string | null;
          from_name?: string | null;
          id?: number;
          is_enabled?: boolean;
          provider?: string;
          reply_to?: string | null;
          sender_domain?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          zoho_routing_enabled?: boolean;
        };
        Update: {
          api_key_ciphertext?: string | null;
          api_key_last4?: string | null;
          contact_inbox?: string | null;
          from_email?: string | null;
          from_name?: string | null;
          id?: number;
          is_enabled?: boolean;
          provider?: string;
          reply_to?: string | null;
          sender_domain?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          zoho_routing_enabled?: boolean;
        };
        Relationships: [];
      };
      email_template_settings: {
        Row: {
          description: string | null;
          display_name: string;
          body_override: string | null;
          is_enabled: boolean;
          subject_override: string | null;
          template_key: string;
          updated_at: string;
        };
        Insert: {
          description?: string | null;
          display_name: string;
          body_override?: string | null;
          is_enabled?: boolean;
          subject_override?: string | null;
          template_key: string;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          display_name?: string;
          body_override?: string | null;
          is_enabled?: boolean;
          subject_override?: string | null;
          template_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          answer: string;
          category: string;
          created_at: string;
          display_order: number;
          id: string;
          is_published: boolean;
          question: string;
          updated_at: string;
        };
        Insert: {
          answer: string;
          category?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_published?: boolean;
          question: string;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          category?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_published?: boolean;
          question?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_oauth_settings: {
        Row: {
          client_id: string | null;
          client_secret_ciphertext: string | null;
          created_at: string;
          id: number;
          is_enabled: boolean;
          redirect_path: string;
          scopes: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          client_id?: string | null;
          client_secret_ciphertext?: string | null;
          created_at?: string;
          id?: number;
          is_enabled?: boolean;
          redirect_path?: string;
          scopes?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          client_id?: string | null;
          client_secret_ciphertext?: string | null;
          created_at?: string;
          id?: number;
          is_enabled?: boolean;
          redirect_path?: string;
          scopes?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      intake_submissions: {
        Row: {
          appointment_id: string | null;
          client_id: string | null;
          completed_at: string | null;
          completion_state: string;
          consent_acknowledged_at: string | null;
          contact_submission_id: string | null;
          created_at: string;
          id: string;
          payload: Json;
          reminder_sent_at: string | null;
          reminder_sent_by: string | null;
          source: string;
          subject_email: string | null;
          subject_name: string | null;
          template_key: string;
          template_version: number;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          completion_state?: string;
          consent_acknowledged_at?: string | null;
          contact_submission_id?: string | null;
          created_at?: string;
          id?: string;
          payload: Json;
          reminder_sent_at?: string | null;
          reminder_sent_by?: string | null;
          source: string;
          subject_email?: string | null;
          subject_name?: string | null;
          template_key: string;
          template_version?: number;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          completion_state?: string;
          consent_acknowledged_at?: string | null;
          contact_submission_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          reminder_sent_at?: string | null;
          reminder_sent_by?: string | null;
          source?: string;
          subject_email?: string | null;
          subject_name?: string | null;
          template_key?: string;
          template_version?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_submissions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intake_submissions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intake_submissions_contact_submission_id_fkey";
            columns: ["contact_submission_id"];
            isOneToOne: false;
            referencedRelation: "contact_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      migration_content_reviews: {
        Row: {
          content_entry_id: string;
          created_at: string;
          decision: string;
          id: string;
          proposed_path: string | null;
          review_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reviewed_by_email: string | null;
          source_id: number;
          source_kind: Database["public"]["Enums"]["content_entry_kind"];
          source_url: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content_entry_id: string;
          created_at?: string;
          decision?: string;
          id?: string;
          proposed_path?: string | null;
          review_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewed_by_email?: string | null;
          source_id: number;
          source_kind: Database["public"]["Enums"]["content_entry_kind"];
          source_url: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          content_entry_id?: string;
          created_at?: string;
          decision?: string;
          id?: string;
          proposed_path?: string | null;
          review_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewed_by_email?: string | null;
          source_id?: number;
          source_kind?: Database["public"]["Enums"]["content_entry_kind"];
          source_url?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "migration_content_reviews_content_entry_id_fkey";
            columns: ["content_entry_id"];
            isOneToOne: true;
            referencedRelation: "content_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          new_status: Database["public"]["Enums"]["payment_status"];
          payment_id: string;
          previous_status: Database["public"]["Enums"]["payment_status"] | null;
          provider_reference: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          new_status: Database["public"]["Enums"]["payment_status"];
          payment_id: string;
          previous_status?: Database["public"]["Enums"]["payment_status"] | null;
          provider_reference?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          new_status?: Database["public"]["Enums"]["payment_status"];
          payment_id?: string;
          previous_status?: Database["public"]["Enums"]["payment_status"] | null;
          provider_reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_reviews: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          new_status: Database["public"]["Enums"]["payment_status"];
          note: string | null;
          payment_id: string;
          previous_status: Database["public"]["Enums"]["payment_status"] | null;
          reviewer_email: string | null;
          reviewer_id: string | null;
          reviewer_name: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          new_status: Database["public"]["Enums"]["payment_status"];
          note?: string | null;
          payment_id: string;
          previous_status?: Database["public"]["Enums"]["payment_status"] | null;
          reviewer_email?: string | null;
          reviewer_id?: string | null;
          reviewer_name?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          new_status?: Database["public"]["Enums"]["payment_status"];
          note?: string | null;
          payment_id?: string;
          previous_status?: Database["public"]["Enums"]["payment_status"] | null;
          reviewer_email?: string | null;
          reviewer_id?: string | null;
          reviewer_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_reviews_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_settings: {
        Row: {
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_instructions: string | null;
          bank_name: string | null;
          callback_path: string;
          created_at: string;
          id: number;
          is_bank_transfer_enabled: boolean;
          is_paystack_enabled: boolean;
          mode: string;
          paystack_public_key: string | null;
          paystack_secret_ciphertext: string | null;
          paystack_secret_last4: string | null;
          paystack_webhook_secret_ciphertext: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_instructions?: string | null;
          bank_name?: string | null;
          callback_path?: string;
          created_at?: string;
          id?: number;
          is_bank_transfer_enabled?: boolean;
          is_paystack_enabled?: boolean;
          mode?: string;
          paystack_public_key?: string | null;
          paystack_secret_ciphertext?: string | null;
          paystack_secret_last4?: string | null;
          paystack_webhook_secret_ciphertext?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_instructions?: string | null;
          bank_name?: string | null;
          callback_path?: string;
          created_at?: string;
          id?: number;
          is_bank_transfer_enabled?: boolean;
          is_paystack_enabled?: boolean;
          mode?: string;
          paystack_public_key?: string | null;
          paystack_secret_ciphertext?: string | null;
          paystack_secret_last4?: string | null;
          paystack_webhook_secret_ciphertext?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_kobo: number;
          appointment_id: string;
          authorization_url: string | null;
          bank_transfer_received_email_claimed_at: string | null;
          checkout_group_reference: string | null;
          transfer_reference: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_reason: string | null;
          id: string;
          metadata: Json;
          payment_failed_email_claimed_at: string | null;
          payment_kind: Database["public"]["Enums"]["payment_kind"];
          payment_review_email_claimed_at: string | null;
          payment_success_email_claimed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_reference: string | null;
          receipt_path: string | null;
          reference: string;
          status: Database["public"]["Enums"]["payment_status"];
          transfer_note: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          amount_kobo: number;
          appointment_id?: string | null;
          authorization_url?: string | null;
          bank_transfer_received_email_claimed_at?: string | null;
          checkout_group_reference?: string | null;
          transfer_reference?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          failed_reason?: string | null;
          id?: string;
          metadata?: Json;
          payment_failed_email_claimed_at?: string | null;
          payment_kind?: Database["public"]["Enums"]["payment_kind"];
          payment_review_email_claimed_at?: string | null;
          payment_success_email_claimed_at?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_reference?: string | null;
          receipt_path?: string | null;
          reference: string;
          status?: Database["public"]["Enums"]["payment_status"];
          transfer_note?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          amount_kobo?: number;
          appointment_id?: string | null;
          authorization_url?: string | null;
          bank_transfer_received_email_claimed_at?: string | null;
          checkout_group_reference?: string | null;
          transfer_reference?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          failed_reason?: string | null;
          id?: string;
          metadata?: Json;
          payment_failed_email_claimed_at?: string | null;
          payment_kind?: Database["public"]["Enums"]["payment_kind"];
          payment_review_email_claimed_at?: string | null;
          payment_success_email_claimed_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_reference?: string | null;
          receipt_path?: string | null;
          reference?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          transfer_note?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      redirects: {
        Row: {
          created_at: string;
          created_by: string | null;
          from_path: string;
          id: string;
          is_active: boolean;
          notes: string | null;
          status_code: number;
          to_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          from_path: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          status_code?: number;
          to_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          from_path?: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          status_code?: number;
          to_path?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminder_settings: {
        Row: {
          id: number;
          reminder_1h_open_max_minutes: number;
          reminder_1h_open_min_minutes: number;
          reminder_24h_open_max_minutes: number;
          reminder_24h_open_min_minutes: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: number;
          reminder_1h_open_max_minutes?: number;
          reminder_1h_open_min_minutes?: number;
          reminder_24h_open_max_minutes?: number;
          reminder_24h_open_min_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: number;
          reminder_1h_open_max_minutes?: number;
          reminder_1h_open_min_minutes?: number;
          reminder_24h_open_max_minutes?: number;
          reminder_24h_open_min_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      security_events: {
        Row: {
          created_at: string;
          details: Json;
          event_type: string;
          id: string;
          identifier: string | null;
          route: string | null;
          severity: string;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          event_type: string;
          id?: string;
          identifier?: string | null;
          route?: string | null;
          severity?: string;
        };
        Update: {
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: string;
          identifier?: string | null;
          route?: string | null;
          severity?: string;
        };
        Relationships: [];
      };
      security_rate_limits: {
        Row: {
          bucket: string;
          hit_count: number;
          identifier: string;
          updated_at: string;
          window_started_at: string;
        };
        Insert: {
          bucket: string;
          hit_count?: number;
          identifier: string;
          updated_at?: string;
          window_started_at?: string;
        };
        Update: {
          bucket?: string;
          hit_count?: number;
          identifier?: string;
          updated_at?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          display_order: number;
          duration_minutes: number;
          id: string;
          in_person_price_ngn: number | null;
          is_active: boolean;
          minimum_lead_time_minutes: number;
          name: string;
          price_ngn: number | null;
          sessions_per_package: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          display_order?: number;
          duration_minutes: number;
          id?: string;
          in_person_price_ngn?: number | null;
          is_active?: boolean;
          minimum_lead_time_minutes?: number;
          name: string;
          price_ngn?: number | null;
          sessions_per_package?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          display_order?: number;
          duration_minutes?: number;
          id?: string;
          in_person_price_ngn?: number | null;
          is_active?: boolean;
          minimum_lead_time_minutes?: number;
          name?: string;
          price_ngn?: number | null;
          sessions_per_package?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      testimonials: {
        Row: {
          author_name: string;
          author_role: string | null;
          avatar_url: string | null;
          created_at: string;
          display_order: number;
          id: string;
          is_published: boolean;
          quote: string;
          rating: number | null;
          updated_at: string;
        };
        Insert: {
          author_name: string;
          author_role?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_published?: boolean;
          quote: string;
          rating?: number | null;
          updated_at?: string;
        };
        Update: {
          author_name?: string;
          author_role?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_published?: boolean;
          quote?: string;
          rating?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      therapist_google_connections: {
        Row: {
          access_token_ciphertext: string | null;
          calendar_id: string;
          created_at: string;
          google_email: string | null;
          last_sync_at: string | null;
          last_sync_error: string | null;
          refresh_token_ciphertext: string | null;
          sync_channel_id: string | null;
          sync_expires_at: string | null;
          sync_resource_id: string | null;
          therapist_id: string;
          token_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          access_token_ciphertext?: string | null;
          calendar_id?: string;
          created_at?: string;
          google_email?: string | null;
          last_sync_at?: string | null;
          last_sync_error?: string | null;
          refresh_token_ciphertext?: string | null;
          sync_channel_id?: string | null;
          sync_expires_at?: string | null;
          sync_resource_id?: string | null;
          therapist_id: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token_ciphertext?: string | null;
          calendar_id?: string;
          created_at?: string;
          google_email?: string | null;
          last_sync_at?: string | null;
          last_sync_error?: string | null;
          refresh_token_ciphertext?: string | null;
          sync_channel_id?: string | null;
          sync_expires_at?: string | null;
          sync_resource_id?: string | null;
          therapist_id?: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "therapist_google_connections_therapist_id_fkey";
            columns: ["therapist_id"];
            isOneToOne: true;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      therapist_services: {
        Row: {
          created_at: string;
          service_id: string;
          therapist_id: string;
        };
        Insert: {
          created_at?: string;
          service_id: string;
          therapist_id: string;
        };
        Update: {
          created_at?: string;
          service_id?: string;
          therapist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "therapist_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "therapist_services_therapist_id_fkey";
            columns: ["therapist_id"];
            isOneToOne: false;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      therapists: {
        Row: {
          bio: string | null;
          created_at: string;
          credentials: string | null;
          display_order: number;
          full_name: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          location: string | null;
          modalities: Database["public"]["Enums"]["session_mode"][];
          role_title: string;
          slug: string;
          specialties: string[];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          credentials?: string | null;
          display_order?: number;
          full_name: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          modalities?: Database["public"]["Enums"]["session_mode"][];
          role_title: string;
          slug: string;
          specialties?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          credentials?: string | null;
          display_order?: number;
          full_name?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          modalities?: Database["public"]["Enums"]["session_mode"][];
          role_title?: string;
          slug?: string;
          specialties?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      appointment_actor: {
        Args: {
          p_appointment: Database["public"]["Tables"]["appointments"]["Row"];
          p_manage_token_hash: string;
        };
        Returns: string;
      };
      cancel_appointment: {
        Args: {
          p_appointment_id: string;
          p_manage_token_hash?: string;
          p_reason?: string;
        };
        Returns: {
          id: string;
          status: Database["public"]["Enums"]["appointment_status"];
        }[];
      };
      consume_rate_limit: {
        Args: {
          p_bucket: string;
          p_identifier: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      expire_stale_holds: { Args: never; Returns: number };
      get_booking_checkout_clock: {
        Args: { p_appointment_ids: string[] };
        Returns: {
          appointment_id: string;
          checkout_expires_at: string | null;
          server_now: string;
        }[];
      };
      get_appointment_by_manage_token: {
        Args: { p_manage_token_hash: string };
        Returns: {
          booking_reference: string;
          cancelled_at: string;
          client_email: string;
          client_name: string;
          client_phone: string;
          ends_at: string;
          hold_expires_at: string;
          id: string;
          service_id: string;
          session_mode: Database["public"]["Enums"]["session_mode"];
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          therapist_id: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      hold_appointment: {
        Args: {
          p_client_email: string;
          p_client_id?: string;
          p_client_name: string;
          p_client_phone: string;
          p_manage_token_hash: string;
          p_notes: string;
          p_service_id: string;
          p_session_mode: Database["public"]["Enums"]["session_mode"];
          p_starts_at: string;
          p_therapist_id: string;
        };
        Returns: {
          booking_reference: string;
          ends_at: string;
          hold_expires_at: string;
          id: string;
          starts_at: string;
        }[];
      };
      list_available_slots: {
        Args: {
          p_from: string;
          p_mode?: Database["public"]["Enums"]["session_mode"];
          p_service_id: string;
          p_to: string;
        };
        Returns: {
          ends_at: string;
          mode: Database["public"]["Enums"]["session_mode"];
          starts_at: string;
          therapist_id: string;
        }[];
      };
      log_section_audit: {
        Args: { p_entry_id: string; p_ops: Json };
        Returns: number;
      };
      log_security_event: {
        Args: {
          p_details: Json;
          p_event_type: string;
          p_identifier: string;
          p_route: string;
          p_severity: string;
        };
        Returns: undefined;
      };
      mark_appointment_status: {
        Args: {
          p_appointment_id: string;
          p_new_status: Database["public"]["Enums"]["appointment_status"];
        };
        Returns: {
          id: string;
          status: Database["public"]["Enums"]["appointment_status"];
        }[];
      };
      mark_payment_status: {
        Args: {
          p_failed_reason?: string;
          p_metadata?: Json;
          p_new_status: Database["public"]["Enums"]["payment_status"];
          p_provider_reference?: string;
          p_reference: string;
        };
        Returns: {
          amount_kobo: number;
          appointment_id: string;
          authorization_url: string | null;
          bank_transfer_received_email_claimed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_reason: string | null;
          id: string;
          metadata: Json;
          payment_failed_email_claimed_at: string | null;
          payment_success_email_claimed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_reference: string | null;
          receipt_path: string | null;
          reference: string;
          status: Database["public"]["Enums"]["payment_status"];
          transfer_note: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      publish_scheduled_content: { Args: never; Returns: number };
      purge_expired_rate_limits: { Args: never; Returns: number };
      record_payment_initiated: {
        Args: {
          p_amount_kobo: number;
          p_appointment_id: string;
          p_authorization_url?: string;
          p_metadata?: Json;
          p_provider: Database["public"]["Enums"]["payment_provider"];
          p_reference: string;
        };
        Returns: {
          amount_kobo: number;
          appointment_id: string;
          authorization_url: string | null;
          bank_transfer_received_email_claimed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_reason: string | null;
          id: string;
          metadata: Json;
          payment_failed_email_claimed_at: string | null;
          payment_success_email_claimed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_reference: string | null;
          receipt_path: string | null;
          reference: string;
          status: Database["public"]["Enums"]["payment_status"];
          transfer_note: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_package_purchase_initiated: {
        Args: {
          p_amount_kobo: number;
          p_client_email?: string | null;
          p_client_id?: string | null;
          p_client_name?: string | null;
          p_client_phone?: string | null;
          p_metadata?: Json;
          p_provider: Database["public"]["Enums"]["payment_provider"];
          p_reference: string;
          p_service_id: string;
        };
        Returns: Database["public"]["Tables"]["payments"]["Row"];
      };
      reschedule_appointment: {
        Args: {
          p_appointment_id: string;
          p_manage_token_hash?: string;
          p_new_session_mode?: Database["public"]["Enums"]["session_mode"];
          p_new_starts_at: string;
          p_new_therapist_id?: string;
        };
        Returns: {
          booking_reference: string;
          ends_at: string;
          id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
        }[];
      };
      restore_content_revision: {
        Args: { p_revision_id: string };
        Returns: Json;
      };
      submit_bank_transfer: {
        Args: {
          p_amount_kobo: number;
          p_appointment_id: string;
          p_manage_token_hash?: string;
          p_receipt_path?: string;
          p_reference: string;
          p_transfer_note?: string;
        };
        Returns: {
          amount_kobo: number;
          appointment_id: string;
          authorization_url: string | null;
          bank_transfer_received_email_claimed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_reason: string | null;
          id: string;
          metadata: Json;
          payment_failed_email_claimed_at: string | null;
          payment_success_email_claimed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_reference: string | null;
          receipt_path: string | null;
          reference: string;
          status: Database["public"]["Enums"]["payment_status"];
          transfer_note: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      verify_bank_transfer: {
        Args: { p_approve: boolean; p_note?: string; p_payment_id: string };
        Returns: {
          amount_kobo: number;
          appointment_id: string;
          authorization_url: string | null;
          bank_transfer_received_email_claimed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_reason: string | null;
          id: string;
          metadata: Json;
          payment_failed_email_claimed_at: string | null;
          payment_success_email_claimed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_reference: string | null;
          receipt_path: string | null;
          reference: string;
          status: Database["public"]["Enums"]["payment_status"];
          transfer_note: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "admin" | "staff" | "client" | "therapist";
      appointment_status:
        "hold" | "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show";
      availability_exception_kind: "blocked" | "added";
      content_entry_kind: "page" | "post" | "category";
      payment_provider: "paystack" | "bank_transfer";
      payment_kind: "appointment" | "package_purchase";
      payment_status:
        "initiated" | "awaiting_confirmation" | "succeeded" | "failed" | "cancelled" | "refunded";
      session_mode: "online" | "in_person" | "phone";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "client", "therapist"],
      appointment_status: [
        "hold",
        "pending_payment",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      availability_exception_kind: ["blocked", "added"],
      content_entry_kind: ["page", "post", "category"],
      payment_kind: ["appointment", "package_purchase"],
      payment_provider: ["paystack", "bank_transfer"],
      payment_status: [
        "initiated",
        "awaiting_confirmation",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ],
      session_mode: ["online", "in_person", "phone"],
    },
  },
} as const;
