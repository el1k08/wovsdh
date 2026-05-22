'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin } from 'lucide-react'

interface Props {
  studios: string[]
}

export function ServiceStudioBadge({ studios }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click (mobile tap-away)
  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  if (studios.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Доступно в ${studios.length} студ${studios.length === 1 ? 'ії' : 'іях'}`}
        aria-expanded={open}
        className="flex items-center justify-center w-6 h-6 rounded-full text-[var(--color-rose)] opacity-60 hover:opacity-100 hover:bg-[var(--color-blush)] transition-all"
      >
        <MapPin size={13} />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-20 w-max max-w-[180px] pointer-events-none">
          <div className="rounded-xl border border-[var(--color-blush)] bg-white shadow-md px-3 py-2">
            <p className="text-[11px] font-semibold text-[var(--color-charcoal)] mb-1 uppercase tracking-wide opacity-60">
              Доступно в:
            </p>
            <ul className="space-y-0.5">
              {studios.map((name) => (
                <li key={name} className="text-xs text-[var(--color-charcoal)] flex items-center gap-1">
                  <span className="text-[var(--color-rose)] opacity-70">·</span>
                  {name}
                </li>
              ))}
            </ul>
          </div>
          {/* Caret */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[var(--color-blush)]" />
        </div>
      )}
    </div>
  )
}
