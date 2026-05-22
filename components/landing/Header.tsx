'use client'

import { useState, useEffect, useCallback } from 'react'
import { Menu, X } from 'lucide-react'
import Button from '@/components/ui/Button'

const navLinks = [
  { label: 'Послуги', href: '#services' },
  { label: 'Галерея', href: '#gallery' },
  { label: 'Про нас', href: '#studios' },
  { label: 'Контакти', href: '#contact' },
]

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 20)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const closeMobile = useCallback(() => setIsMobileOpen(false), [])

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault()
      closeMobile()
      const target = document.querySelector(href)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' })
      }
    },
    [closeMobile],
  )

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/80 backdrop-blur-md shadow-sm'
          : 'bg-transparent',
      ].join(' ')}
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] rounded"
            aria-label="WOVSDH Nails — головна сторінка"
          >
            <span
              className="font-cormorant text-2xl font-semibold tracking-widest text-[var(--color-charcoal)]"
              style={{ fontFamily: 'var(--font-cormorant), serif' }}
            >
              WOVSDH
            </span>
            <span
              className="font-cormorant text-2xl font-light tracking-widest text-[var(--color-rose)]"
              style={{ fontFamily: 'var(--font-cormorant), serif' }}
            >
              Nails
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav
            className="hidden md:flex items-center gap-6"
            aria-label="Основна навігація"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-sm font-medium text-[var(--color-charcoal)] hover:text-[var(--color-rose)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)] rounded px-1"
              >
                {link.label}
              </a>
            ))}
            <Button
              as="a"
              href="#booking"
              onClick={(e) => handleNavClick(e, '#booking')}
              variant="primary"
              size="sm"
            >
              Записатись
            </Button>
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-[var(--color-charcoal)] hover:bg-[var(--color-blush)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
            aria-expanded={isMobileOpen}
            aria-controls="mobile-menu"
            aria-label={isMobileOpen ? 'Закрити меню' : 'Відкрити меню'}
            onClick={() => setIsMobileOpen((prev) => !prev)}
          >
            {isMobileOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {isMobileOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-white/95 backdrop-blur-md border-t border-[var(--color-blush)]"
          role="navigation"
          aria-label="Мобільна навігація"
        >
          <div className="px-4 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="block py-2 px-3 text-base font-medium text-[var(--color-charcoal)] hover:text-[var(--color-rose)] hover:bg-[var(--color-blush)] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-rose)]"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2">
              <Button
                as="a"
                href="#booking"
                onClick={(e) => handleNavClick(e, '#booking')}
                variant="primary"
                size="md"
                className="w-full justify-center"
              >
                Записатись
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
