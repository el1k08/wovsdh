'use client'

import { useState, useCallback } from 'react'
import CitySelector from './CitySelector'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'
import ContactForm from './ContactForm'
import BookingSuccess from './BookingSuccess'
import Button from '@/components/ui/Button'
import type { SlotDTO, BookingCreatedDTO, CreateBookingRequest } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'city' | 'datetime' | 'contacts' | 'success'

const STUDIO_NAMES: Record<'rishon' | 'ashdod', string> = {
  rishon: 'Ришон-ле-Цион',
  ashdod: 'Ашдод',
}

// Progress bar only covers the first 3 user-facing steps
const PROGRESS_STEPS: { key: Step; label: string }[] = [
  { key: 'city', label: 'Студия' },
  { key: 'datetime', label: 'Дата и время' },
  { key: 'contacts', label: 'Контакты' },
]

function getProgressIndex(step: Step): number {
  if (step === 'success') return 3
  return PROGRESS_STEPS.findIndex((s) => s.key === step)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookingForm() {
  const [step, setStep] = useState<Step>('city')
  const [selectedCity, setSelectedCity] = useState<'rishon' | 'ashdod' | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotDTO[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedBooking, setCompletedBooking] = useState<BookingCreatedDTO | null>(null)

  // -------------------------------------------------------------------------
  // Fetch slots
  // -------------------------------------------------------------------------

  const fetchSlots = useCallback(async (city: 'rishon' | 'ashdod', date: string) => {
    setSlotsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/slots?studio_id=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`,
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = (await res.json()) as { slots: SlotDTO[] }
      setSlots(json.slots)
    } catch {
      setError('Произошла ошибка при загрузке слотов. Попробуйте ещё раз.')
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleCitySelect = useCallback(
    (city: 'rishon' | 'ashdod') => {
      setSelectedCity(city)
      setSelectedDate(null)
      setSelectedSlotId(null)
      setSlots([])
      setError(null)
      setStep('datetime')
    },
    [],
  )

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date)
      setSelectedSlotId(null)
      if (selectedCity) {
        fetchSlots(selectedCity, date)
      }
    },
    [selectedCity, fetchSlots],
  )

  const handleSlotChange = useCallback((slotId: string) => {
    setSelectedSlotId(slotId)
    setError(null)
  }, [])

  const handleGoToContacts = useCallback(() => {
    setError(null)
    setStep('contacts')
  }, [])

  const handleBackToDatetime = useCallback(() => {
    setError(null)
    setStep('datetime')
  }, [])

  const handleContactSubmit = useCallback(
    async (data: {
      firstName: string
      lastName: string
      phone: string
      email: string
    }) => {
      if (!selectedCity || !selectedSlotId) return

      setBookingLoading(true)
      setError(null)

      const payload: CreateBookingRequest = {
        slot_id: selectedSlotId,
        studio_id: selectedCity,
        client_first_name: data.firstName,
        client_last_name: data.lastName,
        client_phone: data.phone,
        client_email: data.email,
      }

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.status === 409) {
          const json = (await res.json()) as { error: { code: string } }
          if (json.error?.code === 'SLOT_UNAVAILABLE') {
            setError(
              'К сожалению, этот слот уже занят. Пожалуйста, выберите другое время.',
            )
            setStep('datetime')
            setSelectedSlotId(null)
            // Refresh slots for current city/date
            if (selectedCity && selectedDate) {
              fetchSlots(selectedCity, selectedDate)
            }
            return
          }
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const json = (await res.json()) as { booking: BookingCreatedDTO }
        setCompletedBooking(json.booking)

        // GTM/GA4 conversion event
        if (typeof window !== 'undefined') {
          if ((window as any).dataLayer) {
            ;(window as any).dataLayer.push({
              event: 'booking_completed',
              studio_id: selectedCity,
              slot_id: selectedSlotId,
              value: 1,
              currency: 'ILS',
            })
          }
          // Google Ads conversion (fires only when gtag is loaded directly without GTM)
          if (typeof (window as any).gtag === 'function' && process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID) {
            ;(window as any).gtag('event', 'conversion', {
              send_to: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID,
            })
          }
        }

        setStep('success')
      } catch {
        setError('Произошла ошибка. Попробуйте ещё раз.')
      } finally {
        setBookingLoading(false)
      }
    },
    [selectedCity, selectedSlotId, selectedDate, fetchSlots],
  )

  const handleReset = useCallback(() => {
    setStep('city')
    setSelectedCity(null)
    setSelectedDate(null)
    setSelectedSlotId(null)
    setSlots([])
    setError(null)
    setCompletedBooking(null)
  }, [])

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const progressIndex = getProgressIndex(step)
  const showProgress = step !== 'success'

  return (
    <div className="flex flex-col gap-6">
      {/* Progress bar */}
      {showProgress && (
        <nav aria-label="Прогресс бронирования">
          <ol className="flex items-center justify-between gap-2">
            {PROGRESS_STEPS.map((s, idx) => {
              const isDone = idx < progressIndex
              const isCurrent = idx === progressIndex
              return (
                <li key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={[
                      'h-1.5 w-full rounded-full transition-all duration-300',
                      isDone || isCurrent
                        ? 'bg-[var(--color-rose)]'
                        : 'bg-gray-200',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                  <span
                    className={[
                      'text-xs font-medium transition-colors duration-200',
                      isCurrent
                        ? 'text-[var(--color-rose)]'
                        : isDone
                        ? 'text-[var(--color-charcoal)] opacity-70'
                        : 'text-gray-400',
                    ].join(' ')}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {s.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Steps */}
      {step === 'city' && (
        <section aria-labelledby="step-city-heading">
          <h3
            id="step-city-heading"
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Выберите студию
          </h3>
          <CitySelector value={selectedCity} onChange={handleCitySelect} />
        </section>
      )}

      {step === 'datetime' && (
        <section aria-labelledby="step-datetime-heading">
          <h3
            id="step-datetime-heading"
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Выберите дату
          </h3>
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            disabled={slotsLoading}
          />

          {selectedDate && (
            <div className="mt-6">
              <h3
                className="mb-3 text-base font-semibold"
                style={{ color: 'var(--color-charcoal)' }}
              >
                Выберите время
              </h3>
              <TimePicker
                slots={slots}
                value={selectedSlotId}
                onChange={handleSlotChange}
                loading={slotsLoading}
              />
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setStep('city')
                setError(null)
              }}
            >
              Назад
            </Button>
            {selectedSlotId && (
              <Button
                variant="primary"
                size="md"
                onClick={handleGoToContacts}
                className="flex-1"
              >
                Далее — Ввести контакты
              </Button>
            )}
          </div>
        </section>
      )}

      {step === 'contacts' && (
        <section aria-labelledby="step-contacts-heading">
          <h3
            id="step-contacts-heading"
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Ваши контакты
          </h3>
          <ContactForm
            onSubmit={handleContactSubmit}
            loading={bookingLoading}
          />
          <div className="mt-4">
            <Button
              variant="ghost"
              size="md"
              onClick={handleBackToDatetime}
              disabled={bookingLoading}
            >
              Назад
            </Button>
          </div>
        </section>
      )}

      {step === 'success' && completedBooking && selectedCity && (
        <BookingSuccess
          booking={completedBooking}
          studioName={STUDIO_NAMES[selectedCity]}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
