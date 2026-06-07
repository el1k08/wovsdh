import type {
  ServiceDTO,
  StudioScheduleTemplate,
} from '@/lib/types'

export type { Locale, StudioScheduleTemplate } from '@/lib/types'

// Admin services endpoint returns ServiceDTO + is_active field
export interface AdminServiceDTO extends ServiceDTO {
  is_active: boolean
}

export type AdminTab = 'bookings' | 'schedule' | 'services'

export type SettingsSubTab = 'studios' | 'services' | 'users' | 'instagram' | 'twilio'

export interface InlineMessage {
  type: 'success' | 'error'
  text: string
}

// Local row state for editing schedule
export interface ScheduleRow {
  day_of_week: number
  is_working: boolean
  work_start: string
  work_end: string
}

export interface AdminClientDTO {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  city: string
  consent: boolean
  created_at: string
}

export interface ClientBookingDTO {
  id: string
  status: string
  start_at: string
  end_at: string
  service_snapshot: Record<string, unknown>
  studio_id: string
  created_at: string
}

// Re-export ServiceDTO so consumers can import it from this module
export type { ServiceDTO }
