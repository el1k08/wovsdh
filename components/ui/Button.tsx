import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonElement = 'button' | 'a'

interface BaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: React.ReactNode
}

interface ButtonAsButton extends BaseProps {
  as?: 'button'
  href?: never
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

interface ButtonAsAnchor extends BaseProps {
  as: 'a'
  href: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  target?: string
  rel?: string
  type?: never
  disabled?: never
}

type ButtonProps = ButtonAsButton | ButtonAsAnchor

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[var(--color-rose)] to-[var(--color-gold)] text-white shadow-sm hover:opacity-90 active:opacity-80',
  secondary:
    'border border-[var(--color-rose)] text-[var(--color-rose)] bg-transparent hover:bg-[var(--color-blush)] active:bg-[var(--color-blush)]',
  ghost:
    'text-[var(--color-charcoal)] bg-transparent hover:bg-[var(--color-blush)] active:bg-[var(--color-blush)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] focus-visible:ring-offset-2 cursor-pointer select-none'

export default function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    as,
  } = props

  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(' ')

  const element: ButtonElement = as ?? 'button'

  if (element === 'a') {
    const { href, onClick, target, rel } = props as ButtonAsAnchor
    return (
      <a
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        className={classes}
      >
        {children}
      </a>
    )
  }

  const { onClick, type = 'button', disabled } = props as ButtonAsButton
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  )
}
