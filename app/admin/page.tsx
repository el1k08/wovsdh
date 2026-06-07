'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Settings, Users } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import type { Studio, AdminBookingDTO } from '@/lib/types'
import {
  AuthGate,
  BookingStatusBadge,
  BookingsPanel,
  ClientsSection,
  ScheduleTab,
  ServicesTab,
  StudioServicesAssignmentTab,
  StudiosTab,
  UsersTab,
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
  const [topSection, setTopSection] = useState<'studios' | 'settings' | 'clients'>('studios')
  const [editingBooking, setEditingBooking] = useState<AdminBookingDTO | null>(null)
  const [showUserSettings, setShowUserSettings] = useState(false)

  // Sync URL ↔ nav state
  const hasReadURL = useRef(false)
  useEffect(() => {
    if (!hasReadURL.current) {
      hasReadURL.current = true
      const p = new URLSearchParams(window.location.search)
      const sec = p.get('section')
      if (sec === 'studios' || sec === 'settings' || sec === 'clients') setTopSection(sec)
      const tab = p.get('tab')
      if (tab === 'bookings' || tab === 'schedule' || tab === 'services') setActiveTab(tab as AdminTab)
      const subtab = p.get('subtab')
      if (subtab === 'studios' || subtab === 'services' || subtab === 'users') setSettingsSubTab(subtab as SettingsSubTab)
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
      loadStudios()
    }
  }, [isLoggedIn, loadStudios])

  if (sessionLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </main>
    )
  }

  if (!isLoggedIn) {
    return <AuthGate onAuth={loadStudios} />
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
  ]

  return (
    <main className="min-h-screen bg-[var(--color-cream)] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
            {t('page_title')}
          </h1>
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <UserDropdown
              email={userEmail}
              onOpenSettings={() => setShowUserSettings(true)}
              onSignOut={handleUnauth}
            />
          </div>
        </div>

        {/* Top-level navigation */}
        <div className="flex gap-1 mb-8 p-1 bg-white border border-gray-200 rounded-xl w-fit">
          <button
            onClick={() => setTopSection('studios')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
            <div className="flex gap-2 mb-6 border-b border-gray-100 pb-1">
              {SETTINGS_SUBTABS.map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setSettingsSubTab(sub.key)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px ${
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
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <StudiosTab apiFetch={apiFetch} onUnauth={handleUnauth} onStudiosChanged={loadStudios} />
              </section>
            )}

            {settingsSubTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ServicesTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}

            {settingsSubTab === 'users' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <UsersTab apiFetch={apiFetch} studios={studios} />
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

        {/* Studio switcher + tabs */}
        {topSection === 'studios' && (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
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

            <div className="flex gap-1 mb-8 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
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
          </>
        )}
      </div>

      {/* Edit booking modal */}
      {editingBooking && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setEditingBooking(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
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
    </main>
  )
}
