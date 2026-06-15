import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { createAuthMiddleware } from 'better-auth/api'
import { Pool } from 'pg'
import { recordAuditEvent, extractRequestMeta } from '@/lib/audit'

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  }),
  user: {
    additionalFields: {
      telegramChatId: {
        type: 'string',
        required: false,
        fieldName: 'telegram_chat_id',
      },
      twoFactorEnabled: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        fieldName: 'two_factor_enabled',
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      defaultRole: 'admin',
    }),
  ],
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ],
  hooks: {
    // Runs after every Better-Auth endpoint. Wrapped defensively so audit
    // logging can never break the actual auth response.
    after: createAuthMiddleware(async (ctx) => {
      try {
        const meta = extractRequestMeta(ctx.headers ?? new Headers())

        if (ctx.path === '/sign-in/email') {
          const newSession = ctx.context.newSession
          if (newSession) {
            await recordAuditEvent({
              event: 'LOGIN_SUCCESS',
              userId: newSession.user.id,
              email: newSession.user.email,
              ...meta,
            })
          } else {
            await recordAuditEvent({
              event: 'LOGIN_FAILED',
              email: typeof ctx.body?.email === 'string' ? ctx.body.email : null,
              ...meta,
            })
          }
        } else if (ctx.path === '/sign-out') {
          const session = ctx.context.session
          await recordAuditEvent({
            event: 'LOGOUT',
            userId: session?.user?.id ?? null,
            email: session?.user?.email ?? null,
            ...meta,
          })
        }
      } catch (err) {
        console.error('[auth] audit hook failed', err)
      }
    }),
  },
})
