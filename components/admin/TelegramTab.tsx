'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Send, MessageCircle, FlaskConical } from 'lucide-react'
import type { InlineMessage } from './types'

interface TelegramUser {
  id: string
  telegram_chat_id: number
  name: string
  is_active: boolean
  added_at: string
}

interface TelegramTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

export function TelegramTab({ apiFetch, onUnauth }: TelegramTabProps) {
  const t = useTranslations('admin.telegram_panel')

  const [users, setUsers] = useState<TelegramUser[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<InlineMessage | null>(null)

  const [newName, setNewName] = useState('')
  const [newChatId, setNewChatId] = useState('')
  const [adding, setAdding] = useState(false)
  const [testingNew, setTestingNew] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3000)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/telegram/users')
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_load') }); return }
      const data = await res.json() as { users: TelegramUser[] }
      setUsers(data.users)
    } catch {
      showMsg({ type: 'error', text: t('error_load') })
    } finally {
      setLoading(false)
    }
  }, [apiFetch, onUnauth, t])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = newName.trim()
    const chatIdNum = Number(newChatId.trim())
    if (!trimmedName || !chatIdNum) return

    setAdding(true)
    try {
      const res = await apiFetch('/api/admin/telegram/users', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, telegram_chat_id: chatIdNum }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_add') }); return }
      const data = await res.json() as { user: TelegramUser }
      setUsers((prev) => {
        const exists = prev.find((u) => u.id === data.user.id)
        if (exists) return prev.map((u) => (u.id === data.user.id ? data.user : u))
        return [data.user, ...prev]
      })
      setNewName('')
      setNewChatId('')
      showMsg({ type: 'success', text: t('success_add') })
    } catch {
      showMsg({ type: 'error', text: t('error_add') })
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(user: TelegramUser) {
    try {
      const res = await apiFetch(`/api/admin/telegram/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_toggle') }); return }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)),
      )
    } catch {
      showMsg({ type: 'error', text: t('error_toggle') })
    }
  }

  async function handleTestNew() {
    const trimmedName = newName.trim()
    const chatIdNum = Number(newChatId.trim())
    if (!trimmedName || !chatIdNum) return

    setTestingNew(true)
    try {
      const res = await apiFetch('/api/admin/telegram/test', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, chat_id: chatIdNum }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_test') }); return }
      showMsg({ type: 'success', text: t('success_test', { name: trimmedName }) })
    } catch {
      showMsg({ type: 'error', text: t('error_test') })
    } finally {
      setTestingNew(false)
    }
  }

  async function handleTest(user: TelegramUser) {
    setTestingId(user.id)
    try {
      const res = await apiFetch(`/api/admin/telegram/users/${user.id}`, { method: 'POST' })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_test') }); return }
      showMsg({ type: 'success', text: t('success_test', { name: user.name }) })
    } catch {
      showMsg({ type: 'error', text: t('error_test') })
    } finally {
      setTestingId(null)
    }
  }

  async function handleDelete(user: TelegramUser) {
    if (!confirm(t('delete_confirm', { name: user.name }))) return
    try {
      const res = await apiFetch(`/api/admin/telegram/users/${user.id}`, { method: 'DELETE' })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_delete') }); return }
      showMsg({ type: 'success', text: t('success_delete') })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch {
      showMsg({ type: 'error', text: t('error_delete') })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('heading')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">{t('instructions_title')}</p>
        <p>{t('instructions_text')}</p>
      </div>

      {/* Inline message */}
      {msg && (
        <p
          className={`text-sm px-3 py-2 rounded-lg ${
            msg.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Add user form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('name_placeholder')}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
          required
        />
        <input
          type="number"
          value={newChatId}
          onChange={(e) => setNewChatId(e.target.value)}
          placeholder={t('chat_id_placeholder')}
          className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
          required
          min={1}
        />
        <button
          type="button"
          onClick={handleTestNew}
          disabled={testingNew || !newName.trim() || !newChatId.trim()}
          className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FlaskConical size={14} />
          {testingNew ? t('adding') : t('test_btn')}
        </button>
        <button
          type="submit"
          disabled={adding || !newName.trim() || !newChatId.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          {adding ? t('adding') : t('add_btn')}
        </button>
      </form>

      {/* Users table */}
      {loading ? (
        <p className="text-sm text-gray-400">{t('loading')}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400">{t('no_users')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-blush)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--color-blush)]">
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_name')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_chat_id')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_status')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--color-blush)] last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-[var(--color-charcoal)]">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{user.telegram_chat_id}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(user)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        user.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {user.is_active ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleTest(user)}
                        disabled={testingId === user.id}
                        className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={t('test_btn')}
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('delete_btn')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
