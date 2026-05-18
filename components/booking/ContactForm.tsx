'use client'

import { useState, useCallback } from 'react'
import Button from '@/components/ui/Button'

interface ContactFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
}

interface FieldErrors {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
}

interface ContactFormProps {
  onSubmit: (data: ContactFormData) => void
  loading: boolean
  disabled?: boolean
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

  return errors
}

const INPUT_BASE =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors duration-150 bg-white ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
  'focus:ring-[var(--color-rose)] disabled:opacity-50 disabled:cursor-not-allowed'

const INPUT_NORMAL = 'border-gray-200 text-[var(--color-charcoal)]'
const INPUT_ERROR = 'border-red-400 text-[var(--color-charcoal)]'

export default function ContactForm({ onSubmit, loading, disabled = false }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormData, boolean>>>({})

  const handleChange = useCallback(
    (field: keyof ContactFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...form, [field]: e.target.value }
      setForm(next)
      if (touched[field]) {
        const newErrors = validateData(next)
        setErrors((prev) => ({ ...prev, [field]: newErrors[field] }))
      }
    },
    [form, touched],
  )

  const handleBlur = useCallback(
    (field: keyof ContactFormData) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }))
      const newErrors = validateData(form)
      setErrors((prev) => ({ ...prev, [field]: newErrors[field] }))
    },
    [form],
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const allErrors = validateData(form)
    setErrors(allErrors)
    setTouched({ firstName: true, lastName: true, phone: true, email: true })

    if (Object.keys(allErrors).length === 0) {
      onSubmit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      })
    }
  }

  const isDisabled = loading || disabled

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Контактные данные">
      <div className="flex flex-col gap-5">
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

        {/* Телефон */}
        <div>
          <label
            htmlFor="contact-phone"
            className="mb-1.5 block text-sm font-medium"
            style={{ color: 'var(--color-charcoal)' }}
          >
            Телефон <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange('phone')}
            onBlur={handleBlur('phone')}
            disabled={isDisabled}
            required
            placeholder="+972501234567"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'error-phone' : 'hint-phone'}
            className={`${INPUT_BASE} ${errors.phone ? INPUT_ERROR : INPUT_NORMAL}`}
          />
          {errors.phone ? (
            <p id="error-phone" role="alert" className="mt-1 text-xs text-red-500">
              {errors.phone}
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isDisabled}
          className="mt-2 w-full"
        >
          {loading ? 'Бронирование...' : 'Забронировать'}
        </Button>
      </div>
    </form>
  )
}
