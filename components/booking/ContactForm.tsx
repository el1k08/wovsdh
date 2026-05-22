'use client'

import { useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
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
  existingClientId?: string
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
  const t = useTranslations('contact_form')
  const tv = useTranslations('contact_form.validation')
  const tb = useTranslations('booking')

  function validateData(data: ContactFormData): FieldErrors {
    const errors: FieldErrors = {}
    if (!data.firstName.trim() || data.firstName.trim().length < 2) {
      errors.firstName = tv('first_name_short')
    }
    if (!data.lastName.trim() || data.lastName.trim().length < 2) {
      errors.lastName = tv('last_name_short')
    }
    if (!data.phone.trim()) {
      errors.phone = tv('phone_required')
    } else if (!/^\+[\d+]{9,}$/.test(data.phone.trim())) {
      errors.phone = tv('phone_invalid')
    }
    if (!data.email.trim()) {
      errors.email = tv('email_required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errors.email = tv('email_invalid')
    }
    if (!data.marketing_consent) {
      errors.marketing_consent = tv('consent_required')
    }
    return errors
  }

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
  const [fieldsRevealed, setFieldsRevealed] = useState<boolean>(!!prefillData?.phone)

  const lastLookedUpPhone = useRef<string>('')
  const lookedUpClientId = useRef<string | undefined>(prefillData?.existingClientId)

  const triggerLookup = useCallback(async (normalized: string) => {
    if (lastLookedUpPhone.current === normalized) return
    lastLookedUpPhone.current = normalized
    setLookupState('loading')

    try {
      const res = await fetch(`/api/clients?phone=${encodeURIComponent(normalized)}`)
      const json = (await res.json()) as ClientLookupResponse | { error: unknown }

      if ('error' in json) {
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
        if (field === 'phone' && isPhoneComplete(newValue)) {
          const normalized = normalizePhone(newValue.trim())
          triggerLookup(normalized)
        }
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, touched, triggerLookup],
  )

  const handleBlur = useCallback(
    (field: keyof Pick<ContactFormData, 'firstName' | 'lastName' | 'email'>) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }))
      const newErrors = validateData(form)
      setErrors((prev) => ({ ...prev, [field]: newErrors[field] }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  )

  const handlePhoneBlur = useCallback(async () => {
    setTouched((prev) => ({ ...prev, phone: true }))

    const normalized = normalizePhone(form.phone.trim())
    setForm((prev) => ({ ...prev, phone: normalized }))

    const currentForm = { ...form, phone: normalized }
    const newErrors = validateData(currentForm)
    setErrors((prev) => ({ ...prev, phone: newErrors.phone }))

    if (newErrors.phone || !normalized) return
    await triggerLookup(normalized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <form onSubmit={handleSubmit} noValidate aria-label={t('form_aria')}>
      <div className="flex flex-col gap-5">
        {/* Phone — first for client lookup */}
        <div>
          <label
            htmlFor="contact-phone"
            className="mb-1.5 block text-sm font-medium"
            style={{ color: 'var(--color-charcoal)' }}
          >
            {t('phone_label')} <span aria-hidden="true" className="text-red-500">*</span>
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
              placeholder={t('phone_placeholder')}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'error-phone' : 'hint-phone'}
              className={`${INPUT_BASE} ${errors.phone ? INPUT_ERROR : INPUT_NORMAL}`}
            />
            {lookupState === 'loading' && (
              <span
                aria-label={t('phone_searching')}
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
              {t('client_new')}
            </p>
          ) : lookupState === 'found' ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-charcoal)', opacity: 0.55 }}>
              {t('client_found')}
            </p>
          ) : (
            <p
              id="hint-phone"
              className="mt-1 text-xs"
              style={{ color: 'var(--color-charcoal)', opacity: 0.5 }}
            >
              {t('phone_hint')}
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
            {/* First name */}
            <div>
              <label
                htmlFor="contact-first-name"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {t('first_name_label')} <span aria-hidden="true" className="text-red-500">*</span>
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
                placeholder={t('first_name_placeholder')}
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

            {/* Last name */}
            <div>
              <label
                htmlFor="contact-last-name"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {t('last_name_label')} <span aria-hidden="true" className="text-red-500">*</span>
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
                placeholder={t('last_name_placeholder')}
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
                placeholder={t('email_placeholder')}
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

            {/* Comment */}
            <div>
              <label
                htmlFor="contact-comment"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {t('comment_label')}
              </label>
              <textarea
                id="contact-comment"
                value={form.comment ?? ''}
                onChange={handleChange('comment')}
                disabled={isDisabled}
                rows={3}
                placeholder={t('comment_placeholder')}
                className={`${TEXTAREA_BASE} ${INPUT_NORMAL}`}
              />
            </div>

            {/* Consent */}
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
                  {t('consent_text')}
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
              {loading ? tb('booking_loading') : tb('book_now')}
            </Button>
          </>
        </div>
      </div>
    </form>
  )
}
