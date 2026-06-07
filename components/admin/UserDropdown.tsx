'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface UserDropdownProps {
  email: string
  onOpenSettings: () => void
  onSignOut: () => void
}

export function UserDropdown({ email, onOpenSettings, onSignOut }: UserDropdownProps) {
  const t = useTranslations('admin.user_dropdown')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:border-[var(--color-rose)] transition-colors text-sm"
      >
        <span className="w-7 h-7 rounded-full bg-[var(--color-rose)] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
          {initials}
        </span>
        <span className="hidden sm:block text-[var(--color-charcoal)] max-w-[140px] truncate">{email}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); onOpenSettings() }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-charcoal)] hover:bg-gray-50 transition-colors"
          >
            <Settings size={15} className="text-gray-400" />
            {t('settings')}
          </button>
          <button
            onClick={() => { setOpen(false); onSignOut() }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            {t('sign_out')}
          </button>
        </div>
      )}
    </div>
  )
}
