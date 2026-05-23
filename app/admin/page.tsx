'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Settings, Users } from 'lucide-react'
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
} from '@/components/admin'
import type { AdminTab, SettingsSubTab } from '@/components/admin/types'
import { formatLocalTime, formatLocalDate } from '@/components/admin/utils'

export default function AdminPage() {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [secret, setSecret] = useState<string | null>(null)
  const [studio, setStudio] = useState<string>('rishon')
  const [studios, setStudios] = useState<Studio[]>([])
  const [activeTab, setActiveTab] = useState<AdminTab>('bookings')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('studios')
  const [topSection, setTopSection] = useState<'studios' | 'settings' | 'clients'>('studios')
  const [editingBooking, setEditingBooking] = useState<AdminBookingDTO | null>(null)

  // Bootstrap secret from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('admin_secret')
    if (stored) setSecret(stored)
  }, [])

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      return fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': secret ?? '',
          ...(options.headers ?? {}),
        },
      })
    },
    [secret],
  )

  function handleUnauth() {
    localStorage.removeItem('admin_secret')
    setSecret(null)
  }

  const loadStudios = useCallback(async () => {
    const res = await apiFetch('/api/admin/studios')
    if (!res.ok) return
    const data = await res.json() as { studios: Studio[] }
    setStudios(data.studios)
    setStudio((prev) => {
      if (data.studios.length === 0) return ''
      return data.studios.find((s) => s.id === prev) ? prev : data.studios[0].id
    })
  }, [apiFetch])

  useEffect(() => {
    if (secret) {
      loadStudios()
    }
  }, [secret, loadStudios])

  if (!secret) {
    return <AuthGate onAuth={setSecret} />
  }

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'bookings', label: t('tabs.bookings') },
    { key: 'schedule', label: t('tabs.schedule') },
    { key: 'services', label: t('tabs.services') },
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
            <button
              onClick={() => {
                localStorage.removeItem('admin_secret')
                setSecret(null)
              }}
              className="text-sm text-gray-500 underline"
            >
              {t('logout_btn')}
            </button>
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
        </div>

        {/* Settings panel */}
        {topSection === 'settings' && (
          <div>
            <div className="flex gap-2 mb-6 border-b border-gray-100 pb-1">
              {([
                { key: 'studios', label: t('tabs.studios') },
                { key: 'services', label: t('tabs.services') },
              ] as { key: SettingsSubTab; label: string }[]).map((sub) => (
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
                <StudiosTab apiFetch={apiFetch} onUnauth={handleUnauth} onStudiosChanged={loadStudios} secret={secret} />
              </section>
            )}

            {settingsSubTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ServicesTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
          </div>
        )}

        {/* Clients section */}
        {topSection === 'clients' && (
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
            <div className="flex gap-2 mb-6">
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

            {/* Tab bar */}
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
                secret={secret}
                apiFetch={apiFetch}
                onUnauth={handleUnauth}
                onEditBooking={setEditingBooking}
              />
            )}

            {activeTab === 'schedule' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ScheduleTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} secret={secret} />
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

      {/* Edit booking modal — rendered at root level so it works from any section */}
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
    </main>
  )
}
