// Shapes of the JSON returned by the RPC functions (see supabase/migrations), plus table helpers.
import type { Database } from './database.types';

export type { Database };
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
export type Category = Enums<'participant_category'>;
export type Role = Enums<'app_role'>;
export type ScanAction = Enums<'scan_action'>;

export type CardLeg = {
  leg_id: string; kind: Enums<'leg_kind'>; direction: Enums<'leg_direction'>; code: string; label: string | null;
  departs_at: string | null; boarded_at: string | null; arrived_at: string | null;
};

// public.participant_card / scan_badge → participant
export type ParticipantCard = {
  id: string; edition_id: string; category: Category; title: string | null; first_name: string; last_name: string;
  preferred_name: string | null; phone: string | null; language: string; mobility: Enums<'mobility'>;
  logistics_note: string | null; photo_path: string | null; version: number;
  room: null | { room_id: string; number: string; floor: string | null; zone: string | null; bed: string | null;
    checked_in_at: string | null; facility: string; facility_label: string | null; facility_kind: string; colour: string | null };
  legs: CardLeg[];
  carers: { name: string; phone: string | null; kind: Enums<'care_kind'> }[];
  in_care: { id: string; name: string; kind: Enums<'care_kind'> }[];
  teams: string[];
  emergency_contacts: { name: string; relation: string | null; phone: string }[];
};

export type ScanResultCode = 'ok' | 'wrong_leg' | 'revoked' | 'invalid' | 'not_authorized' | 'leg_required' | 'no_room';
export type ScanResult = { result: ScanResultCode; replayed?: boolean; credential_kind?: string; participant?: ParticipantCard };

// public.my_pilgrimage
export type MyPilgrimage = {
  generated_at: string;
  edition: { id: string; year: number; title: string; starts_on: string; ends_on: string; timezone: string; emergency_phone: string | null };
  roles: Role[];
  me: null | { id: string; category: Category; title: string | null; first_name: string; last_name: string;
    preferred_name: string | null; language: string; mobility: Enums<'mobility'> };
  legs: (CardLeg & { origin: string | null; destination: string | null; arrives_at: string | null; meeting_point: string | null;
    meeting_at: string | null; note: string | null; responsible: string | null; updated_at: string })[];
  accommodation: null | { facility: string; facility_kind: string; address: string | null; phone: string | null;
    lat: number | null; lng: number | null; note: string | null; room: string; floor: string | null; zone: string | null; bed: string | null; updated_at: string };
  carers: { name: string; phone: string | null; kind: Enums<'care_kind'> }[];
  in_care: { id: string; name: string; kind: Enums<'care_kind'>; starts_at: string | null; ends_at: string | null; room: string | null }[];
  duties: { title: string; starts_at: string; ends_at: string; location: string | null; note: string | null }[];
  events: { id: string; starts_at: string; ends_at: string | null; title: string; location: string | null; place_id: string | null;
    description: string | null; updated_at: string; changed: boolean }[];
  places: Place[];
  contacts: { label: string; name: string | null; phone: string | null; is_emergency: boolean }[];
  announcements: { id: string; title: string; body: string | null; critical: boolean; published_at: string; acked: boolean }[];
};

export type Place = { id: string; name: string; kind: string | null; description: string | null; accessibility: string | null;
  directions: string | null; lat: number | null; lng: number | null };

export const isTeam = (roles: Role[]) => roles.length > 0;
export const canScan = (roles: Role[]) => roles.some((r) => r === 'organizer' || r === 'medical' || r === 'staff');
