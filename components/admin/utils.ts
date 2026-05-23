import type { StudioScheduleTemplate } from '@/lib/types'
import type { ScheduleRow } from './types'

export function todayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatLocalTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('uk-UA', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatLocalDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('uk-UA', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function buildDefaultSchedule(): ScheduleRow[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    is_working: i >= 1 && i <= 5, // Mon–Fri on by default
    work_start: '10:00',
    work_end: '18:00',
  }))
}

export function templateToRows(templates: StudioScheduleTemplate[]): ScheduleRow[] {
  const defaults = buildDefaultSchedule()
  templates.forEach((t) => {
    const row = defaults.find((r) => r.day_of_week === t.day_of_week)
    if (row) {
      row.is_working = t.is_working
      // work_start/work_end come as 'HH:mm:ss' — strip seconds
      row.work_start = t.work_start.slice(0, 5)
      row.work_end = t.work_end.slice(0, 5)
    }
  })
  return defaults
}

export function buildStudioDefaultSchedule(): ScheduleRow[] {
  return [
    { day_of_week: 0, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Вс
    { day_of_week: 1, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Пн
    { day_of_week: 2, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Вт
    { day_of_week: 3, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Ср
    { day_of_week: 4, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Чт
    { day_of_week: 5, is_working: true,  work_start: '09:00', work_end: '14:00' }, // Пт
    { day_of_week: 6, is_working: false, work_start: '09:00', work_end: '20:00' }, // Сб
  ]
}
