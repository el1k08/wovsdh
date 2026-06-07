'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, UserPlus, Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'
import type { InlineMessage } from './types'
import type { Studio } from '@/lib/types'
import type { UserRole } from '@/lib/admin-auth'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  studios?: string[]
}

interface UsersTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  studios: Studio[]
}

export function UsersTab({ apiFetch, studios }: UsersTabProps) {
  const t = useTranslations('admin.users_tab')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<InlineMessage | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('master')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assigningStudios, setAssigningStudios] = useState<Record<string, string[]>>({})
  const [savingStudios, setSavingStudios] = useState<string | null>(null)

  const ROLE_LABELS: Record<string, string> = {
    admin: t('role_admin'),
    manager: t('role_manager'),
    master: t('role_master'),
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    master: 'bg-green-100 text-green-700',
  }

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 4000)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await authClient.admin.listUsers({ query: {} })
      if (error) { showMsg({ type: 'error', text: t('error_load') }); return }
      const rawUsers = (data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? u.email.split('@')[0],
        role: (u as { role?: string }).role ?? 'admin',
        createdAt: String(u.createdAt),
      }))
      const withStudios = await Promise.all(rawUsers.map(async (u) => {
        if (u.role !== 'master') return { ...u, studios: [] }
        try {
          const res = await apiFetch(`/api/admin/users/${u.id}/studios`)
          if (!res.ok) return { ...u, studios: [] }
          const d = await res.json() as { studios: string[] }
          return { ...u, studios: d.studios }
        } catch {
          return { ...u, studios: [] }
        }
      }))
      setUsers(withStudios)
      const studioMap: Record<string, string[]> = {}
      withStudios.forEach((u) => { studioMap[u.id] = u.studios ?? [] })
      setAssigningStudios(studioMap)
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setLoading(false)
    }
  }, [apiFetch, t])

  useEffect(() => { void loadUsers() }, [loadUsers])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim()
    const name = newName.trim() || email.split('@')[0]
    if (!email || !newPassword) return
    setAdding(true)
    try {
      const { error } = await authClient.admin.createUser({
        email,
        password: newPassword,
        name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: newRole as any,
      })
      if (error) {
        showMsg({ type: 'error', text: error.message ?? t('error_add') })
        return
      }
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setNewRole('master')
      showMsg({ type: 'success', text: `${email}` })
      void loadUsers()
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(t('delete_confirm', { email: user.email }))) return
    setDeletingId(user.id)
    try {
      const { error } = await authClient.admin.removeUser({ userId: user.id })
      if (error) { showMsg({ type: 'error', text: t('error_delete') }); return }
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      showMsg({ type: 'success', text: user.email })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveStudios(userId: string) {
    setSavingStudios(userId)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/studios`, {
        method: 'PUT',
        body: JSON.stringify({ studios: assigningStudios[userId] ?? [] }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_studios') }); return }
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, studios: assigningStudios[userId] } : u))
      showMsg({ type: 'success', text: t('success_studios') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setSavingStudios(null)
    }
  }

  function toggleStudio(userId: string, studioId: string) {
    setAssigningStudios((prev) => {
      const current = prev[userId] ?? []
      return {
        ...prev,
        [userId]: current.includes(studioId)
          ? current.filter((s) => s !== studioId)
          : [...current, studioId],
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('heading')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('desc')}</p>
      </div>

      {msg && (
        <p className={`text-sm px-3 py-2 rounded-lg ${
          msg.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.text}
        </p>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('name_placeholder')}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
            required
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('password_placeholder')}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
            required
            minLength={8}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)] bg-white"
          >
            <option value="master">{t('role_master')}</option>
            <option value="manager">{t('role_manager')}</option>
            <option value="admin">{t('role_admin')}</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <UserPlus size={14} />
            {adding ? t('adding') : t('add_btn')}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">{t('loading')}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400">{t('no_users')}</p>
      ) : (
        <div className="rounded-xl border border-[var(--color-blush)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--color-blush)]">
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_name_email')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_role')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_added')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <>
                  <tr key={user.id} className="border-b border-[var(--color-blush)] last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-charcoal)]">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.role === 'master' && (
                          <button
                            onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                            className={`p-1.5 rounded-lg transition-colors ${expandedId === user.id ? 'text-[var(--color-rose)] bg-[var(--color-blush)]' : 'text-gray-400 hover:text-[var(--color-rose)] hover:bg-[var(--color-blush)]'}`}
                            title={t('studios_btn_title')}
                          >
                            <Building2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                          title={t('delete_btn_title')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {user.role === 'master' && expandedId === user.id && (
                    <tr key={`${user.id}-studios`} className="border-b border-[var(--color-blush)] bg-gray-50/50">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('studios_title')}</p>
                          {studios.length === 0 ? (
                            <p className="text-xs text-gray-400">{t('no_studios')}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {studios.map((s) => {
                                const checked = (assigningStudios[user.id] ?? []).includes(s.id)
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => toggleStudio(user.id, s.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                      checked
                                        ? 'bg-[var(--color-rose)] text-white border-[var(--color-rose)]'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-[var(--color-rose)]'
                                    }`}
                                  >
                                    {s.name}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                          <button
                            onClick={() => handleSaveStudios(user.id)}
                            disabled={savingStudios === user.id}
                            className="mt-1 px-3 py-1.5 bg-[var(--color-rose)] text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {savingStudios === user.id ? t('saving_studios') : t('save_studios')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border border-gray-100 rounded-xl p-4 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('roles_legend')}</p>
        <div className="space-y-1.5 text-xs text-gray-600">
          <p><span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium mr-1.5">{t('role_admin')}</span>{t('role_admin_desc')}</p>
          <p><span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium mr-1.5">{t('role_manager')}</span>{t('role_manager_desc')}</p>
          <p><span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium mr-1.5">{t('role_master')}</span>{t('role_master_desc')}</p>
        </div>
      </div>
    </div>
  )
}
