'use client'

import { useState, useCallback, useEffect } from 'react'
import CitySelector from './CitySelector'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'
import ServicePicker from './ServicePicker'
import ContactForm from './ContactForm'
import BookingSuccess from './BookingSuccess'
import Button from '@/components/ui/Button'
import type {
  ServiceDTO,
  AvailableStartTime,
  BookingCreatedDTO,
  CreateBookingRequest,
  PublicStudioDTO,
  GetStudiosResponse,
} from '@/lib/types'
import type { ContactFormData } from './ContactForm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'city' | 'service' | 'datetime' | 'contacts' | 'success'


const PROGRESS_STEPS: { key: Step; label: string }[] = [
  { key: 'city', label: 'Студия' },
  { key: 'service', label: 'Услуга' },
  { key: 'datetime', label: 'Дата и время' },
  { key: 'contacts', label: 'Контакты' },
]

function getProgressIndex(step: Step): number {
  if (step === 'success') return PROGRESS_STEPS.length
  return PROGRESS_STEPS.findIndex((s) => s.key === step)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookingForm() {
  const [step, setStep] = useState<Step>('city')
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedStartAt, setSelectedStartAt] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<ServiceDTO | null>(null)
  const [services, setServices] = useState<ServiceDTO[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [availableStartTimes, setAvailableStartTimes] = useState<AvailableStartTime[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedBooking, setCompletedBooking] = useState<BookingCreatedDTO | null>(null)
  const [studios, setStudios] = useState<PublicStudioDTO[]>([])
  const [studiosLoading, setStudiosLoading] = useState(true)

  useEffect(() => {
    fetch('/api/studios')
      .then(r => r.json())
      .then((data: GetStudiosResponse) => setStudios(data.studios ?? []))
      .catch(() => {/* use empty list */})
      .finally(() => setStudiosLoading(false))
  }, [])

  // -------------------------------------------------------------------------
  // Fetch services
  // -------------------------------------------------------------------------

  const fetchServices = useCallback(async (city: string) => {
    setServicesLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/services?studio_id=${encodeURIComponent(city)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { services: ServiceDTO[] }
      setServices(json.services ?? [])
    } catch {
      setError('Произошла ошибка при загрузке услуг. Попробуйте ещё раз.')
      setServices([])
    } finally {
      setServicesLoading(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Fetch available start times
  // -------------------------------------------------------------------------

  const fetchAvailableSlots = useCallback(
    async (city: string, date: string, serviceId: string) => {
      setSlotsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/slots?studio_id=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}&service_id=${encodeURIComponent(serviceId)}`,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { available_start_times: AvailableStartTime[] }
        setAvailableStartTimes(json.available_start_times ?? [])
      } catch {
        setError('Произошла ошибка при загрузке доступного времени. Попробуйте ещё раз.')
        setAvailableStartTimes([])
      } finally {
        setSlotsLoading(false)
      }
    },
    [],
  )

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleCitySelect = useCallback(
    (city: string) => {
      setSelectedCity(city)
      setSelectedService(null)
      setSelectedDate(null)
      setSelectedStartAt(null)
      setServices([])
      setAvailableStartTimes([])
      setError(null)
      fetchServices(city)
      setStep('service')
    },
    [fetchServices],
  )

  const handleServiceChange = useCallback((id: string, svc: ServiceDTO) => {
    setSelectedService(svc)
    setSelectedStartAt(null)
    setAvailableStartTimes([])
    setStep('datetime')
  }, [])

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date)
      setSelectedStartAt(null)
      if (selectedCity && selectedService) {
        fetchAvailableSlots(selectedCity, date, selectedService.id)
      }
    },
    [selectedCity, selectedService, fetchAvailableSlots],
  )

  const handleStartAtChange = useCallback((startAt: string) => {
    setSelectedStartAt(startAt)
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
    async (data: ContactFormData) => {
      if (!selectedCity || !selectedService || !selectedStartAt) return

      setBookingLoading(true)
      setError(null)

      const payload: CreateBookingRequest = {
        studio_id: selectedCity,
        service_id: selectedService.id,
        start_at: selectedStartAt,
        client_first_name: data.firstName,
        client_last_name: data.lastName,
        client_phone: data.phone,
        client_email: data.email,
        comment: data.comment || undefined,
        marketing_consent: data.marketing_consent,
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
            setError('К сожалению, это время уже занято. Пожалуйста, выберите другое время.')
            setStep('datetime')
            setSelectedStartAt(null)
            if (selectedCity && selectedDate && selectedService) {
              fetchAvailableSlots(selectedCity, selectedDate, selectedService.id)
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
          const winWithDL = window as unknown as { dataLayer?: unknown[] }
          if (winWithDL.dataLayer) {
            winWithDL.dataLayer.push({
              event: 'booking_completed',
              studio_id: selectedCity,
              service_id: selectedService.id,
              value: 1,
              currency: 'ILS',
            })
          }
          // Google Ads conversion (fires only when gtag is loaded directly without GTM)
          const w = window as { gtag?: (...args: unknown[]) => void }
          if (typeof w.gtag === 'function' && process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID) {
            w.gtag('event', 'conversion', {
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
    [selectedCity, selectedService, selectedStartAt, selectedDate, fetchAvailableSlots],
  )

  const handleReset = useCallback(() => {
    setStep('city')
    setSelectedCity(null)
    setSelectedDate(null)
    setSelectedStartAt(null)
    setSelectedService(null)
    setServices([])
    setAvailableStartTimes([])
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
                      isDone || isCurrent ? 'bg-[var(--color-rose)]' : 'bg-gray-200',
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

      {/* Step: city */}
      {step === 'city' && (
        <section aria-labelledby="step-city-heading">
          <h3
            id="step-city-heading"
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Выберите студию
          </h3>
          <CitySelector
            studios={studios}
            value={selectedCity}
            onChange={handleCitySelect}
            loading={studiosLoading}
          />
        </section>
      )}

      {/* Step: service */}
      {step === 'service' && (
        <section aria-labelledby="step-service-heading">
          <h3
            id="step-service-heading"
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Выберите услугу
          </h3>
          <ServicePicker
            services={services}
            value={selectedService?.id ?? null}
            onChange={handleServiceChange}
            loading={servicesLoading}
          />
          <div className="mt-6">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setError(null)
                setStep('city')
              }}
            >
              Назад
            </Button>
          </div>
        </section>
      )}

      {/* Step: datetime */}
      {step === 'datetime' && selectedService && (
        <section aria-labelledby="step-datetime-heading">
          <h3
            id="step-datetime-heading"
            className="mb-1 text-base font-semibold"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Дата и время
          </h3>
          <p
            className="mb-4 text-sm"
            style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}
          >
            {selectedService.name}
          </p>
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
                startTimes={availableStartTimes}
                value={selectedStartAt}
                onChange={handleStartAtChange}
                loading={slotsLoading}
              />
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setError(null)
                setStep('service')
              }}
            >
              Назад
            </Button>
            {selectedStartAt && (
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

      {/* Step: contacts */}
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

      {/* Step: success */}
      {step === 'success' && completedBooking && selectedCity && (
        <BookingSuccess
          booking={completedBooking}
          studioName={studios.find(s => s.id === selectedCity)?.name ?? selectedCity ?? ''}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
