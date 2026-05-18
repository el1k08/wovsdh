// =============================================================================
// Database Entity Types
// All timestamps are ISO 8601 strings with UTC offset as returned by Supabase.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum SlotStatus {
  Available = 'available',
  Booked = 'booked',
  Blocked = 'blocked',
}

export enum BookingStatus {
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Cancelled = 'CANCELLED',
}

export enum EmailType {
  Confirmation = 'confirmation',
  Cancellation = 'cancellation',
}

// ---------------------------------------------------------------------------
// Database Row Types
// These match the PostgreSQL column names and types exactly.
// ---------------------------------------------------------------------------

export interface Studio {
  id: string;                      // TEXT primary key, e.g. 'rishon', 'ashdod'
  name: string;
  city: string;
  google_calendar_id: string | null;
  timezone: string;                // always 'Asia/Jerusalem'
  created_at: string;              // TIMESTAMPTZ as ISO string
}

export interface Slot {
  id: string;                      // UUID
  studio_id: string;               // FK → studios.id
  start_at: string;                // TIMESTAMPTZ as ISO string (UTC)
  end_at: string;                  // TIMESTAMPTZ as ISO string (UTC)
  status: SlotStatus;
  created_at: string;
}

export interface Booking {
  id: string;                         // UUID
  slot_id: string;                    // UUID FK → slots.id
  studio_id: string;                  // TEXT FK → studios.id (denormalized)
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
  status: BookingStatus;
  cancellation_token: string;         // UUID — embedded in cancellation email link
  google_calendar_event_id: string | null;
  telegram_message_id: number | null; // BIGINT
  confirmed_at: string | null;        // TIMESTAMPTZ or null
  cancelled_at: string | null;        // TIMESTAMPTZ or null
  created_at: string;
  updated_at: string;
}

export interface AllowedUser {
  id: string;                      // UUID
  telegram_chat_id: number;        // BIGINT (Telegram user/chat numeric ID)
  name: string;
  is_active: boolean;
  added_at: string;                // TIMESTAMPTZ as ISO string
}

export interface EmailLog {
  id: string;                      // UUID
  booking_id: string;              // UUID FK → bookings.id
  email_type: EmailType;
  recipient_email: string;
  sent_at: string;                 // TIMESTAMPTZ as ISO string
  error: string | null;            // null on success, SMTP error string on failure
}

// ---------------------------------------------------------------------------
// API Request Types
// ---------------------------------------------------------------------------

export interface GetSlotsRequest {
  studio_id: string;   // 'rishon' | 'ashdod'
  date: string;        // 'YYYY-MM-DD' in local Asia/Jerusalem time
}

export interface CreateBookingRequest {
  slot_id: string;
  studio_id: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
}

export interface CancelBookingRequest {
  token: string;       // cancellation_token UUID from the email link
}

export interface GenerateSlotsRequest {
  studio_id: string;
  date: string;               // 'YYYY-MM-DD'
  slot_duration_minutes: number;
  start_time: string;         // 'HH:mm' in Asia/Jerusalem local time
  end_time: string;           // 'HH:mm' in Asia/Jerusalem local time
}

export interface GetAdminSlotsRequest {
  studio_id: string;
  date_from: string;   // 'YYYY-MM-DD'
  date_to: string;     // 'YYYY-MM-DD'
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

/**
 * A slot as returned to the client (no internal fields like created_at).
 */
export interface SlotDTO {
  id: string;
  studio_id: string;
  start_at: string;    // ISO 8601 with timezone offset
  end_at: string;      // ISO 8601 with timezone offset
  status: SlotStatus;
}

/**
 * A booking as returned to the client (sensitive fields omitted).
 * Used in GET /api/bookings/[token] — does not expose email, phone, or last name.
 */
export interface BookingPublicDTO {
  id: string;
  studio_id: string;
  studio_name: string;
  client_first_name: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
}

/**
 * The minimal booking data returned after a successful POST /api/bookings.
 */
export interface BookingCreatedDTO {
  id: string;
  slot_id: string;
  studio_id: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  created_at: string;
}

/**
 * A slot entry in the admin list response, optionally with an active booking.
 */
export interface AdminSlotDTO extends SlotDTO {
  booking?: {
    id: string;
    client_first_name: string;
    client_last_name: string;
    status: BookingStatus;
  };
}

// ---------------------------------------------------------------------------
// API Response Envelopes
// ---------------------------------------------------------------------------

export interface GetSlotsResponse {
  slots: SlotDTO[];
}

export interface CreateBookingResponse {
  booking: BookingCreatedDTO;
}

export interface GetBookingByTokenResponse {
  booking: BookingPublicDTO;
}

export interface CancelBookingResponse {
  message: string;
  booking: {
    id: string;
    status: BookingStatus.Cancelled;
    cancelled_at: string;
  };
}

export interface GenerateSlotsResponse {
  created: number;
  skipped: number;
  slots: SlotDTO[];
}

export interface GetAdminSlotsResponse {
  slots: AdminSlotDTO[];
}

export interface DeleteSlotResponse {
  message: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Error Response Envelope
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'INVALID_PARAMS'
  | 'SLOT_NOT_FOUND'
  | 'SLOT_UNAVAILABLE'
  | 'SLOT_HAS_ACTIVE_BOOKING'
  | 'BOOKING_NOT_FOUND'
  | 'ALREADY_CANCELLED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Telegram Types
// ---------------------------------------------------------------------------

/**
 * Parsed callback_query.data values from Telegram inline keyboard buttons.
 */
export type TelegramCallbackAction =
  | { type: 'confirm'; booking_id: string }
  | { type: 'cancel'; booking_id: string };

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message: {
    message_id: number;
    chat: { id: number };
  };
  data: string;
}

export interface TelegramUpdate {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
  message?: {
    message_id: number;
    from: TelegramUser;
    chat: { id: number };
    text?: string;
  };
}
