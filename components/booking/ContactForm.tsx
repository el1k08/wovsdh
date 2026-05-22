'use client'

import { useState, useCallback, useRef } from 'react'
import Button from '@/components/ui/Button'
import { normalizePhone } from '@/lib/phone-utils'
import type { ClientLookupResponse } from '@/lib/types'

export interface ContactFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
  comment?: string
  marketing_consent: boolean
  existingClientId?: string   // populated when phone lookup finds an existing client
}

interface FieldErrors {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  comment?: string
  marketing_consent?: string
}

export interface ContactFormProps {
  onSubmit: (data: ContactFormData) => void
  loading: boolean
  disabled?: boolean
  prefillData?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    existingClientId?: string
  }
}

function validateData(data: ContactFormData): FieldErrors {
  const errors: FieldErrors = {}

  if (!data.firstName.trim() || data.firstName.trim().length < 2) {
    errors.firstName = 'Имя должно содержать не менее 2 символов'
  }
  if (!data.lastName.trim() || data.lastName.trim().length < 2) {
    errors.lastName = 'Фамилия должна содержать не менее 2 символов'
  }
  if (!data.phone.trim()) {
    errors.phone = 'Введите номер телефона'
  } else if (!/^\+[\d+]{9,}$/.test(data.phone.trim())) {
    errors.phone = 'Телефон должен начинаться с + и содержать не менее 10 символов'
  }
  if (!data.email.trim()) {
    errors.email = 'Введите email'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Введите корректный email'
  }
  if (!data.marketing_consent) {
    errors.marketing_consent = 'Необходимо согласие на обработку данных'
  }

  return errors
}

const INPUT_BASE =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors duration-150 bg-white ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
  'focus:ring-[var(--color-rose)] disabled:opacity-50 disabled:cursor-not-allowed'

const TEXTAREA_BASE =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors duration-150 bg-white ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
  'focus:ring-[var(--color-rose)] disabled:opacity-50 disabled:cursor-not-allowed resize-none'

const INPUT_NORMAL = 'border-gray-200 text-[var(--color-charcoal)]'
const INPUT_ERROR = 'border-red-400 text-[var(--color-charcoal)]'

type LookupState = 'idle' | 'loading' | 'found' | 'not-found'

function isPhoneComplete(value: string): boolean {
  const stripped = value.replace(/[\s\-()]/g, '')
  return /^\+972\d{9}$/.test(stripped) || /^0\d{9}$/.test(stripped)
}

export default function ContactForm({ onSubmit, loading, disabled = false, prefillData }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>({
    firstName: prefillData?.firstName ?? '',
    lastName: prefillData?.lastName ?? '',
    phone: prefillData?.phone ?? '',
    email: prefillData?.email ?? '',
    comment: '',
    marketing_consent: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormData, boolean>>>({})
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  // Secondary fields are revealed after the first completed phone lookup
  const [fieldsRevealed, setFieldsRevealed] = useState<boolean>(!!prefillData?.phone)

  // Tracks the last phone that was successfully looked up so we don't re-fetch on re-blur
  const lastLookedUpPhone = useRef<string>('')
  // Stores the client ID returned by a successful phone lookup
  const lookedUpClientId = useRef<string | undefined>(prefillData?.existingClientId)

  const triggerLookup = useCallback(async (normalized: string) => {
    // Idempotent — skip if this exact number was already looked up
    if (lastLookedUpPhone.current === normalized) return
    lastLookedUpPhone.current = normalized
    setLookupState('loading')

    try {
      const res = await fetch(`/api/clients?phone=${encodeURIComponent(normalized)}`)
      const json = (await res.json()) as ClientLookupResponse | { error: unknown }

      if ('error' in json) {
        // Server error — silently ignore, don't block the form
        setLookupState('idle')
        setFieldsRevealed(true)
        return
      }

      const lookup = json as ClientLookupResponse

      if (lookup.found) {
        setLookupState('found')
        lookedUpClientId.current = lookup.client.id
      } else {
        setLookupState('not-found')
        lookedUpClientId.current = undefined
      }
      setFieldsRevealed(true)
    } catch {
      // Network error — silently ignore
      setLookupState('idle')
      setFieldsRevealed(true)
    }
  }, [])

  const handleChange = useCallback(
    (field: keyof Pick<ContactFormData, 'firstName' | 'lastName' | 'phone' | 'email' | 'comment'>) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value
        const next = { ...form, [field]: newValue }
        setForm(next)
        if (touched[field]) {
          const newErrors = validateData(next)
          setErrors((prev) => ({ ...prev, [field]: newErrors[field] }))
        }
        // Auto-trigger lookup as soon as the user types a complete Israeli phone number
        if (field === 'phone' && isPhoneComplete(newValue)) {
          const normalized = normalizePhone(newValue.trim())
          triggerLookup(normalized)
        }
      },
    [form, touched, triggerLookup],
  )

  const handleBlur = useCallback(
    (field: keyof Pick<ContactFormData, 'firstName' | 'lastName' | 'email'>) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }))
      const newErrors = validateData(form)
      setErrors((prev) => ({ ...prev, [field]: newErrors[field] }))
    },
    [form],
  )

  const handlePhoneBlur = useCallback(async () => {
    setTouched((prev) => ({ ...prev, phone: true }))

    const normalized = normalizePhone(form.phone.trim())

    // Update the field to the normalized value immediately
    setForm((prev) => ({ ...prev, phone: normalized }))

    // Validate the normalized value
    const currentForm = { ...form, phone: normalized }
    const newErrors = validateData(currentForm)
    setErrors((prev) => ({ ...prev, phone: newErrors.phone }))

    // If the number is complete and was already looked up on change, skip the fetch
    if (newErrors.phone || !normalized) return
    await triggerLookup(normalized)
  }, [form, triggerLookup])

  const handleConsentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...form, marketing_consent: e.target.checked }
      setForm(next)
      if (touched.marketing_consent) {
        const newErrors = validateData(next)
        setErrors((prev) => ({ ...prev, marketing_consent: newErrors.marketing_consent }))
      }
    },
    [form, touched],
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const allErrors = validateData(form)
    setErrors(allErrors)
    setTouched({
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      marketing_consent: true,
    })

    if (Object.keys(allErrors).length === 0) {
      onSubmit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        comment: form.comment?.trim() || undefined,
        marketing_consent: form.marketing_consent,
        existingClientId: lookedUpClientId.current,
      })
    }
  }

  const isDisabled = loading || disabled

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Контактные данные">
      <div className="flex flex-col gap-5">
        {/* Телефон — first for client lookup */}
        <div>
          <label
            htmlFor="contact-phone"
            className="mb-1.5 block text-sm font-medium"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Телефон <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="contact-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              onBlur={handlePhoneBlur}
              disabled={isDisabled}
              required
              placeholder="+972501234567"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'error-phone' : 'hint-phone'}
              className={`${INPUT_BASE} ${errors.phone ? INPUT_ERROR : INPUT_NORMAL}`}
            />
            {lookupState === 'loading' && (
              <span
                aria-label="Поиск клиента..."
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              >
                <svg
                  className="h-4 w-4 animate-spin text-[var(--color-rose)]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </span>
            )}
          </div>
          {errors.phone ? (
            <p id="error-phone" role="alert" className="mt-1 text-xs text-red-500">
              {errors.phone}
            </p>
          ) : lookupState === 'not-found' ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-charcoal)', opacity: 0.55 }}>
              Новый клиент
            </p>
          ) : lookupState === 'found' ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-charcoal)', opacity: 0.55 }}>
              Клиент найден — данные будут обновлены
            </p>
          ) : (
            <p
              id="hint-phone"
              className="mt-1 text-xs"
              style={{ color: 'var(--color-charcoal)', opacity: 0.5 }}
            >
              Начинается с +, например +972501234567
            </p>
          )}
        </div>

        {/* Secondary fields — revealed after phone lookup completes */}
        <div
          aria-live="polite"
          className={[
            'flex flex-col gap-5 overflow-hidden transition-all duration-300 ease-in-out',
            fieldsRevealed
              ? 'max-h-[2000px] opacity-100'
              : 'max-h-0 opacity-0 pointer-events-none',
          ].join(' ')}
        >
          <>
              {/* Имя */}
              <div>
                <label
                  htmlFor="contact-first-name"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-charcoal)' }}
                >
                  Имя <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="contact-first-name"
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  onBlur={handleBlur('firstName')}
                  disabled={isDisabled}
                  required
                  minLength={2}
                  placeholder="Анна"
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? 'error-first-name' : undefined}
                  className={`${INPUT_BASE} ${errors.firstName ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {errors.firstName && (
                  <p id="error-first-name" role="alert" className="mt-1 text-xs text-red-500">
                    {errors.firstName}
                  </p>
                )}
              </div>

              {/* Фамилия */}
              <div>
                <label
                  htmlFor="contact-last-name"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-charcoal)' }}
                >
                  Фамилия <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="contact-last-name"
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                  onBlur={handleBlur('lastName')}
                  disabled={isDisabled}
                  required
                  minLength={2}
                  placeholder="Иванова"
                  aria-invalid={!!errors.lastName}
                  aria-describedby={errors.lastName ? 'error-last-name' : undefined}
                  className={`${INPUT_BASE} ${errors.lastName ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {errors.lastName && (
                  <p id="error-last-name" role="alert" className="mt-1 text-xs text-red-500">
                    {errors.lastName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-charcoal)' }}
                >
                  Email <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  onBlur={handleBlur('email')}
                  disabled={isDisabled}
                  required
                  placeholder="anna@example.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'error-email' : undefined}
                  className={`${INPUT_BASE} ${errors.email ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {errors.email && (
                  <p id="error-email" role="alert" className="mt-1 text-xs text-red-500">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Комментарий (необязательно) */}
              <div>
                <label
                  htmlFor="contact-comment"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-charcoal)' }}
                >
                  Комментарий
                </label>
                <textarea
                  id="contact-comment"
                  value={form.comment ?? ''}
                  onChange={handleChange('comment')}
                  disabled={isDisabled}
                  rows={3}
                  placeholder="Комментарий к записи (необязательно)"
                  className={`${TEXTAREA_BASE} ${INPUT_NORMAL}`}
                />
              </div>

              {/* Согласие на обработку данных */}
              <div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    id="contact-consent"
                    checked={form.marketing_consent}
                    onChange={handleConsentChange}
                    disabled={isDisabled}
                    aria-invalid={!!errors.marketing_consent}
                    aria-describedby={errors.marketing_consent ? 'error-consent' : undefined}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-rose)] disabled:cursor-not-allowed"
                  />
                  <span
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--color-charcoal)' }}
                  >
                    Я согласен(а) с обработкой персональных данных и получением уведомлений
                    о статусе записи на указанный телефон/email
                    <span aria-hidden="true" className="ml-1 text-red-500">*</span>
                  </span>
                </label>
                {errors.marketing_consent && (
                  <p id="error-consent" role="alert" className="mt-1 text-xs text-red-500">
                    {errors.marketing_consent}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isDisabled}
                className="mt-2 w-full"
              >
                {loading ? 'Бронирование...' : 'Забронировать'}
              </Button>
            </>
        </div>
      </div>
    </form>
  )
}
