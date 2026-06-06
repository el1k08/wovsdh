'use client'

import { useState, useEffect } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import type { InlineMessage } from './types'

interface AdminUser {
  id: string
  email: string
  createdAt: string
}

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<InlineMessage | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 4000)
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const { data, error } = await authClient.admin.listUsers({ query: {} })
      if (error) { showMsg({ type: 'error', text: 'Ошибка загрузки пользователей' }); return }
      setUsers((data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: String(u.createdAt),
      })))
    } catch {
      showMsg({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email || !newPassword) return
    setAdding(true)
    try {
      const { error } = await authClient.admin.createUser({
        email,
        password: newPassword,
        name: email.split('@')[0],
        role: 'admin',
      })
      if (error) {
        showMsg({ type: 'error', text: error.message ?? 'Ошибка добавления' })
        return
      }
      setNewEmail('')
      setNewPassword('')
      showMsg({ type: 'success', text: `Пользователь ${email} добавлен` })
      void loadUsers()
    } catch {
      showMsg({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Удалить ${user.email}?`)) return
    setDeletingId(user.id)
    try {
      const { error } = await authClient.admin.removeUser({ userId: user.id })
      if (error) { showMsg({ type: 'error', text: 'Ошибка удаления' }); return }
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      showMsg({ type: 'success', text: `${user.email} удалён` })
    } catch {
      showMsg({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">Мастера / Администраторы</h2>
        <p className="text-sm text-gray-500 mt-0.5">Пользователи с доступом в админ-панель</p>
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

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Email"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
          required
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Пароль (мин. 8 символов)"
          className="w-52 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <UserPlus size={14} />
          {adding ? 'Добавление...' : 'Добавить'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400">Нет пользователей</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-blush)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--color-blush)]">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Добавлен</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--color-blush)] last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-[var(--color-charcoal)]">{user.email}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={deletingId === user.id}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
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
