import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { sendMessage } from '@/lib/telegram'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/telegram/test]'

// POST /api/admin/telegram/test — send test message to a chat_id without saving
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  let body: { chat_id?: unknown; name?: unknown }
  try {
    body = (await request.json()) as { chat_id?: unknown; name?: unknown }
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_BODY', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  const chatId = Number(body.chat_id)
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!chatId || chatId <= 0 || !name) {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'chat_id (number) and name (string) are required.' } },
      { status: 400 },
    )
  }

  const result = await sendMessage({
    chat_id: chatId,
    text:
      `✅ <b>Тестове повідомлення</b>\n\n` +
      `Привіт, <b>${name}</b>! Сповіщення налаштовані правильно.\n` +
      `Ви будете отримувати повідомлення про нові записи.`,
    parse_mode: 'HTML',
  })

  if (!result.ok) {
    console.error(`${LOG_PREFIX} Telegram sendMessage failed`, { chatId, result })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to send Telegram message. Check the bot token and chat ID.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
