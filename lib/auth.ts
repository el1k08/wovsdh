import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { Pool } from 'pg'

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
})
