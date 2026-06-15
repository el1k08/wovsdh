// =============================================================================
// Database Entity Types
// All timestamps are ISO 8601 strings with UTC offset as returned by Supabase.
// =============================================================================

// ---------------------------------------------------------------------------
// i18n Translation Types
// ---------------------------------------------------------------------------

export type Locale = 'uk' | 'ru' | 'en' | 'he'

export interface ServiceTranslation {
  name: string;
  description: string;
}

export interface StudioTranslation {
  name: string;
  schedule_text: string;
  street?: string;
  city?: string;
}

export type ServiceTranslations = Record<Locale, ServiceTranslation>
export type StudioTranslations = Record<Locale, StudioTranslation>

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
  street: string;
  google_calendar_id: string | null;
  timezone: string;                // always 'Asia/Jerusalem'
  schedule_text: string;           // Free-text schedule description for landing page
  sort_order: number;
  image_url: string | null;
  created_at: string;              // TIMESTAMPTZ as ISO string
  translations: StudioTranslations;
}

export interface Slot {
  id: string;                      // UUID
  studio_id: string;               // FK → studios.id
  start_at: string;                // TIMESTAMPTZ as ISO string (UTC)
  status: SlotStatus;
  created_at: string;
}

export interface Service {
  id: string;
  studio_id: string | null;
  icon: string | null;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  translations: ServiceTranslations;
}

export interface StudioScheduleTemplate {
  id: string;
  studio_id: string;
  day_of_week: number;  // 0=Sun..6=Sat
  is_working: boolean;
  work_start: string;   // 'HH:mm:ss'
  work_end: string;     // 'HH:mm:ss'
}

export interface BookingSlot {
  booking_id: string;
  slot_id: string;
}

export interface Booking {
  id: string;
  studio_id: string;
  service_id: string | null;
  service_snapshot: Record<string, unknown>;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
  comment: string | null;
  marketing_consent: boolean;
  status: BookingStatus;
  cancellation_token: string;
  client_id?: string;               // FK → clients.id (optional — legacy bookings predate client table)
  google_calendar_event_id: string | null;
  telegram_message_id: number | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;                      // UUID
  firstName: string;
  lastName: string;
  phone: string;                   // immutable after creation
  email?: string;
  city: string;
  consent: boolean;
  createdAt: string;               // TIMESTAMPTZ as ISO string
  updatedAt: string;               // TIMESTAMPTZ as ISO string
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
  studio_id: string;
  date: string;       // 'YYYY-MM-DD'
  service_id: string; // UUID — to determine duration for sliding window
}

export interface CreateBookingRequest {
  studio_id: string;
  service_id: string;      // UUID
  start_at: string;        // ISO UTC timestamp — chosen from available start times
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
  comment?: string;
  marketing_consent: boolean;
  client_id?: string;      // UUID FK → clients.id — omitted for legacy/anonymous bookings
  language?: string;       // 'uk' | 'en' | 'he' — used for email localisation
}

export interface CancelBookingRequest {
  token: string;       // cancellation_token UUID from the email link
}

export interface UpsertMasterScheduleRequest {
  studio_id: string;
  days: Array<{
    day_of_week: number;
    is_working: boolean;
    work_start: string;  // 'HH:mm'
    work_end: string;    // 'HH:mm'
  }>;
}

export interface GenerateSlotsFromTemplateRequest {
  studio_id: string;
  date_from: string;  // 'YYYY-MM-DD'
  date_to: string;    // 'YYYY-MM-DD'
}

export interface UpdateBookingDurationRequest {
  new_duration_minutes: number;
}

export interface RescheduleBookingRequest {
  new_start_at: string;
  new_duration_minutes?: number;
}

export interface CreateServiceRequest {
  studio_id?: string | null;
  icon?: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  sort_order?: number;
  translations?: ServiceTranslations;
}

export interface UpdateServiceRequest extends Partial<CreateServiceRequest> {
  is_active?: boolean;
}

export interface CreateStudioRequest {
  id: string;
  name: string;
  street: string;
  city: string;
  timezone?: string;
  schedule: Array<{
    day_of_week: number;
    is_working: boolean;
    work_start: string;
    work_end: string;
  }>;
  translations?: StudioTranslations;
}

export interface UpdateStudioRequest {
  name?: string;
  street?: string;
  city?: string;
  timezone?: string;
  schedule_text?: string;
  translations?: StudioTranslations;
}

export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  city: string;
  consent: true;                   // must be explicitly true — enforced at the type level
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  consent?: boolean;
  // phone is intentionally excluded — immutable after creation
}

/** Wizard-layer contact data collected in the booking flow. */
export interface ClientContactData {
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  city: string;
  consent: boolean;
  existingClientId?: string;       // populated when a prior-client lookup succeeds
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface SlotDTO {
  id: string;
  studio_id: string;
  start_at: string;
  status: SlotStatus;
}

export interface AvailableStartTime {
  start_at: string;  // ISO UTC
}

export interface GetAvailableSlotsResponse {
  available_start_times: AvailableStartTime[];
}

export interface ServiceDTO {
  id: string;
  studio_id: string | null;
  icon: string | null;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  sort_order: number;
  translations: ServiceTranslations;
}

export interface GetServicesResponse {
  services: ServiceDTO[];
}

export interface PublicStudioDTO {
  id: string;
  name: string;
  city: string;
  street: string;
  translations: StudioTranslations;
}

export interface GetStudiosResponse {
  studios: PublicStudioDTO[];
}

export interface BookingPublicDTO {
  id: string;
  studio_id: string;
  studio_name: string;
  client_first_name: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
}

export interface BookingCreatedDTO {
  id: string;
  studio_id: string;
  service_id: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;  // computed: start_at + duration_minutes
  created_at: string;
}

export interface AdminBookingDTO {
  id: string;
  studio_id: string;
  service_id: string | null;
  service_snapshot: Record<string, unknown>;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
  comment: string | null;
  marketing_consent: boolean;
  status: BookingStatus;
  cancellation_token: string;
  slots: Array<{ slot_id: string; start_at: string }>;
  start_at: string;
  end_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdminSlotDTO extends SlotDTO {
  booking?: {
    id: string;
    client_first_name: string;
    client_last_name: string;
    status: BookingStatus;
  };
}

export interface GetMasterScheduleResponse {
  schedule: StudioScheduleTemplate[];
}

export interface GenerateSlotsFromTemplateResponse {
  created: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// API Response Envelopes
// ---------------------------------------------------------------------------

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

export interface GetAdminSlotsResponse {
  slots: AdminSlotDTO[];
}

export interface GetAdminBookingsResponse {
  bookings: AdminBookingDTO[];
}

export interface DeleteSlotResponse {
  message: string;
  id: string;
}

/** Discriminated union — narrow on `found` to access `client`. */
export type ClientLookupResponse =
  | { found: true; client: Client }
  | { found: false };

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
  | 'SERVICE_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'STUDIO_NOT_FOUND'
  | 'STUDIO_HAS_ACTIVE_BOOKINGS'
  | 'STUDIO_ID_TAKEN'
  | 'CLIENT_NOT_FOUND'
  | 'PHONE_ALREADY_EXISTS'
  | 'INTERNAL_ERROR'
  | 'INVALID_BODY'
  | 'NO_TELEGRAM'
  | 'NO_CODE'
  | 'CODE_EXPIRED'
  | 'INVALID_CODE';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Telegram Types
// ---------------------------------------------------------------------------

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
