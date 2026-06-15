'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Settings, Users, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import type { Studio, AdminBookingDTO } from '@/lib/types'
import {
  AuthGate,
  TwoFactorVerify,
  BookingStatusBadge,
  BookingsPanel,
  ClientsSection,
  InstagramTab,
  TwilioTab,
  ScheduleTab,
  ServicesTab,
  StudioServicesAssignmentTab,
  StudiosTab,
  UsersTab,
  SecurityTab,
  ProfilePanel,
  UserDropdown,
  UserSettingsModal,
} from '@/components/admin'
import type { AdminTab, SettingsSubTab } from '@/components/admin/types'
import { formatLocalTime, formatLocalDate } from '@/components/admin/utils'

type UserRole = 'admin' | 'manager' | 'master'

export default function AdminPage() {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const { data: session, isPending: sessionLoading } = authClient.useSession()
  const isLoggedIn = !!session?.user
  const userEmail = session?.user?.email ?? ''
  const userRole: UserRole = (() => {
    const r = (session?.user as { role?: string } | undefined)?.role
    if (r === 'manager') return 'manager'
    if (r === 'master') return 'master'
    return 'admin'
  })()

  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'admin' || userRole === 'manager'

  const [studio, setStudio] = useState<string>('rishon')
  const [studios, setStudios] = useState<Studio[]>([])
  const [activeTab, setActiveTab] = useState<AdminTab>('bookings')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('studios')
  const [topSection, setTopSection] = useState<'studios' | 'settings' | 'clients' | 'profile'>('studios')
  const [mobileStudioOpen, setMobileStudioOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<AdminBookingDTO | null>(null)
  const [showUserSettings, setShowUserSettings] = useState(false)
  const [twoFactorPending, setTwoFactorPending] = useState<boolean | null>(null)

  // Sync URL ↔ nav state
  const hasReadURL = useRef(false)
  useEffect(() => {
    if (!hasReadURL.current) {
      hasReadURL.current = true
      const p = new URLSearchParams(window.location.search)
      const sec = p.get('section')
      if (sec === 'studios' || sec === 'settings' || sec === 'clients' || sec === 'profile') setTopSection(sec)
      const tab = p.get('tab')
      if (tab === 'bookings' || tab === 'schedule' || tab === 'services') setActiveTab(tab as AdminTab)
      const subtab = p.get('subtab')
      if (subtab === 'studios' || subtab === 'services' || subtab === 'users' || subtab === 'instagram' || subtab === 'twilio' || subtab === 'security') setSettingsSubTab(subtab as SettingsSubTab)
      const studioParam = p.get('studio')
      if (studioParam) setStudio(studioParam)
      return
    }
    const p = new URLSearchParams()
    p.set('section', topSection)
    p.set('tab', activeTab)
    p.set('subtab', settingsSubTab)
    if (studio) p.set('studio', studio)
    window.history.replaceState(null, '', `/admin?${p.toString()}`)
  }, [topSection, activeTab, settingsSubTab, studio])

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      return fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
      })
    },
    [],
  )

  function handleUnauth() {
    void authClient.signOut()
  }

  const loadStudios = useCallback(async () => {
    const res = await apiFetch('/api/admin/studios')
    if (!res.ok) return
    const data = await res.json() as { studios: Studio[] }
    let studioList = data.studios

    // Masters only see their assigned studios
    if (userRole === 'master' && session?.user?.id) {
      try {
        const r = await apiFetch(`/api/admin/users/${session.user.id}/studios`)
        if (r.ok) {
          const d = await r.json() as { studios: string[] }
          studioList = studioList.filter((s) => d.studios.includes(s.id))
        }
      } catch { /* ignore */ }
    }

    setStudios(studioList)
    setStudio((prev) => {
      if (studioList.length === 0) return ''
      return studioList.find((s) => s.id === prev) ? prev : studioList[0]?.id ?? ''
    })
  }, [apiFetch, userRole, session?.user?.id])

  useEffect(() => {
    if (isLoggedIn) {
      void apiFetch('/api/admin/user/profile').then(async (res) => {
        if (!res.ok) return
        const data = await res.json() as { twoFactorPending?: boolean }
        setTwoFactorPending(data.twoFactorPending ?? false)
      })
      loadStudios()
    }
  }, [isLoggedIn, loadStudios, apiFetch])

  if (sessionLoading || (isLoggedIn && twoFactorPending === null)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </main>
    )
  }

  if (!isLoggedIn) {
    return <AuthGate onAuth={loadStudios} />
  }

  if (twoFactorPending === true) {
    return (
      <TwoFactorVerify
        apiFetch={apiFetch}
        onVerified={() => setTwoFactorPending(false)}
        onSignOut={handleUnauth}
      />
    )
  }

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'bookings', label: t('tabs.bookings') },
    { key: 'schedule', label: t('tabs.schedule') },
    { key: 'services', label: t('tabs.services') },
  ]

  // Settings subtabs (no Telegram — moved to user settings)
  const SETTINGS_SUBTABS: { key: SettingsSubTab; label: string }[] = [
    { key: 'studios', label: t('tabs.studios') },
    { key: 'services', label: t('tabs.services') },
    { key: 'users', label: t('tabs.users') },
    { key: 'instagram', label: t('tabs.instagram') },
    { key: 'twilio', label: t('tabs.twilio') },
    { key: 'security', label: t('tabs.security') },
  ]

  return (
    <main className="app-shell font-ios min-h-screen bg-[var(--color-cream)] p-4 md:p-8 pb-28 sm:pb-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pt-safe">
          <h1 className="text-3xl sm:text-2xl font-bold sm:font-semibold tracking-tight text-[var(--color-charcoal)]">
            {t('page_title')}
          </h1>
          <div className="hidden sm:flex items-center gap-4 self-start sm:self-auto">
            <UserDropdown
              email={userEmail}
              onOpenSettings={() => setShowUserSettings(true)}
              onSignOut={handleUnauth}
            />
          </div>
        </div>

        {/* Top-level navigation — desktop (mobile uses the bottom tab bar) */}
        <div className="hidden sm:flex gap-1 mb-8 p-1 bg-white border border-gray-200 rounded-xl w-fit max-w-full overflow-x-auto">
          <button
            onClick={() => setTopSection('studios')}
            className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
              topSection === 'studios'
                ? 'bg-[var(--color-rose)] text-white shadow-sm'
                : 'text-[var(--color-charcoal)] hover:bg-gray-50'
            }`}
          >
            <Building2 size={16} />
            {t('tabs.studios')}
          </button>

          {isAdmin && (
            <button
              onClick={() => setTopSection('settings')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
                topSection === 'settings'
                  ? 'bg-[var(--color-rose)] text-white shadow-sm'
                  : 'text-[var(--color-charcoal)] hover:bg-gray-50'
              }`}
            >
              <Settings size={16} />
              {t('tabs.settings')}
            </button>
          )}

          {isManager && (
            <button
              onClick={() => setTopSection('clients')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
                topSection === 'clients'
                  ? 'bg-[var(--color-rose)] text-white shadow-sm'
                  : 'text-[var(--color-charcoal)] hover:bg-gray-50'
              }`}
            >
              <Users size={16} />
              {t('tabs.clients')}
            </button>
          )}
        </div>

        {/* Settings panel — admin only */}
        {topSection === 'settings' && isAdmin && (
          <div>
            <div className="flex gap-2 mb-6 border-b border-gray-100 pb-1 overflow-x-auto">
              {SETTINGS_SUBTABS.map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setSettingsSubTab(sub.key)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 whitespace-nowrap ${
                    settingsSubTab === sub.key
                      ? 'border-[var(--color-rose)] text-[var(--color-rose)]'
                      : 'border-transparent text-gray-500 hover:text-[var(--color-charcoal)]'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {settingsSubTab === 'studios' && (
              <section className="sm:bg-white sm:border sm:border-[var(--color-blush)] sm:rounded-xl sm:p-6">
                <StudiosTab apiFetch={apiFetch} onUnauth={handleUnauth} onStudiosChanged={loadStudios} />
              </section>
            )}

            {settingsSubTab === 'services' && (
              <section className="sm:bg-white sm:border sm:border-[var(--color-blush)] sm:rounded-xl sm:p-6">
                <ServicesTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}

            {settingsSubTab === 'users' && (
              <section className="sm:bg-white sm:border sm:border-[var(--color-blush)] sm:rounded-xl sm:p-6">
                <UsersTab apiFetch={apiFetch} studios={studios} />
              </section>
            )}

            {settingsSubTab === 'instagram' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <InstagramTab apiFetch={apiFetch} />
              </section>
            )}

            {settingsSubTab === 'twilio' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <TwilioTab apiFetch={apiFetch} />
              </section>
            )}

            {settingsSubTab === 'security' && (
              <section className="sm:bg-white sm:border sm:border-[var(--color-blush)] sm:rounded-xl sm:p-6">
                <SecurityTab apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
          </div>
        )}

        {/* Clients section — admin + manager */}
        {topSection === 'clients' && isManager && (
          <ClientsSection
            apiFetch={apiFetch}
            onUnauth={handleUnauth}
            onEditBooking={setEditingBooking}
            hideBookingsModal={!!editingBooking}
          />
        )}

        {/* Profile section — mobile (reached via bottom tab) */}
        {topSection === 'profile' && (
          <div className="sm:hidden">
            <ProfilePanel apiFetch={apiFetch} onSignOut={handleUnauth} />
          </div>
        )}

        {/* Studios section */}
        {topSection === 'studios' && (
          <>
            {/* Mobile: studio list (master view, Telegram-style) */}
            {!mobileStudioOpen && (
              <ul className="sm:hidden -mt-2 rounded-2xl bg-white border border-black/5 divide-y divide-black/5 overflow-hidden">
                {studios.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => { setStudio(s.id); setMobileStudioOpen(true) }}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-black/5 transition-colors"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-blush)] text-[var(--color-rose)] shrink-0">
                          <Building2 size={18} />
                        </span>
                        <span className="truncate text-sm font-medium text-[var(--color-charcoal)]">{s.name}</span>
                      </span>
                      <ChevronRight size={18} className="text-gray-300 shrink-0" />
                    </button>
                  </li>
                ))}
                {studios.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-gray-400">—</li>
                )}
              </ul>
            )}

            {/* Mobile: back to studio list (detail view) */}
            {mobileStudioOpen && (
              <button
                onClick={() => setMobileStudioOpen(false)}
                className="sm:hidden -mt-2 mb-3 flex items-center gap-0.5 text-[var(--color-rose)] text-sm font-medium"
              >
                <ChevronLeft size={20} />
                {t('tabs.studios')}
              </button>
            )}

            {/* Desktop: studio switcher row */}
            <div className="hidden sm:flex gap-2 mb-6 flex-wrap">
              {studios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudio(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    studio === s.id
                      ? 'bg-[var(--color-rose)] text-white border-[var(--color-rose)]'
                      : 'bg-white text-[var(--color-charcoal)] border-gray-300 hover:border-[var(--color-rose)]'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* Studio detail — desktop always, mobile only when a studio is opened */}
            <div className={mobileStudioOpen ? '' : 'hidden sm:block'}>
            <h2 className="sm:hidden text-2xl font-bold tracking-tight text-[var(--color-charcoal)] mb-4">
              {studios.find((s) => s.id === studio)?.name}
            </h2>

            <div className="flex gap-1 mb-8 border-b border-gray-200 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-[var(--color-rose)] text-[var(--color-rose)]'
                      : 'border-transparent text-gray-500 hover:text-[var(--color-charcoal)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'bookings' && (
              <BookingsPanel
                studio={studio}
                apiFetch={apiFetch}
                onUnauth={handleUnauth}
                onEditBooking={setEditingBooking}
              />
            )}

            {activeTab === 'schedule' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ScheduleTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}

            {activeTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <StudioServicesAssignmentTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
            </div>
          </>
        )}
      </div>

      {/* Edit booking modal */}
      {editingBooking && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingBooking(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {t('bookings_panel.detail_heading')}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-6">
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_client')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {editingBooking.client_first_name} {editingBooking.client_last_name}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_phone')}</dt>
              <dd className="text-[var(--color-charcoal)]">{editingBooking.client_phone}</dd>
              <dt className="text-gray-500 self-center">Email</dt>
              <dd className="text-[var(--color-charcoal)]">{editingBooking.client_email}</dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_date')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {editingBooking.start_at ? formatLocalDate(editingBooking.start_at) : '—'}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_time')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {editingBooking.start_at && editingBooking.end_at
                  ? `${formatLocalTime(editingBooking.start_at)}–${formatLocalTime(editingBooking.end_at)}`
                  : '—'}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_service')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {typeof (editingBooking.service_snapshot as { name?: string }).name === 'string'
                  ? (editingBooking.service_snapshot as { name?: string }).name
                  : '—'}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_status')}</dt>
              <dd><BookingStatusBadge status={editingBooking.status} /></dd>
              {editingBooking.comment && (
                <>
                  <dt className="text-gray-500 self-start pt-0.5">{t('bookings_panel.detail_comment')}</dt>
                  <dd className="text-[var(--color-charcoal)]">{editingBooking.comment}</dd>
                </>
              )}
            </dl>
            <div className="flex justify-end">
              <button
                onClick={() => setEditingBooking(null)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {tCommon('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User settings modal */}
      {showUserSettings && (
        <UserSettingsModal
          onClose={() => setShowUserSettings(false)}
          apiFetch={apiFetch}
        />
      )}

      {/* Mobile bottom tab bar (iOS-style, frosted glass) */}
      <nav
        className="glass sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/5 pb-safe"
        aria-label={t('page_title')}
      >
        <div className="flex items-stretch justify-around px-2 pt-1.5">
          {([
            { key: 'studios' as const, label: t('tabs.studios'), Icon: Building2, show: true },
            { key: 'clients' as const, label: t('tabs.clients'), Icon: Users, show: isManager },
            { key: 'settings' as const, label: t('tabs.settings'), Icon: Settings, show: isAdmin },
            { key: 'profile' as const, label: t('tabs.profile'), Icon: User, show: true },
          ])
            .filter((item) => item.show)
            .map(({ key, label, Icon }) => {
              const active = topSection === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTopSection(key)
                    if (key === 'studios') setMobileStudioOpen(false)
                  }}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors active:bg-black/5"
                  style={{ color: active ? 'var(--color-rose)' : '#8a8080' }}
                >
                  <Icon size={23} strokeWidth={active ? 2.4 : 1.9} />
                  <span className="text-[11px] font-medium leading-none">{label}</span>
                </button>
              )
            })}
        </div>
      </nav>
    </main>
  )
}
