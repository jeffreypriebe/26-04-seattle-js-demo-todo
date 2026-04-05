import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { eq, and, gt } from 'drizzle-orm'
import { db } from '../db/index'
import { users, passwordResetTokens } from '../db/schema'

const RESET_TOKEN_TTL_MS = 3_600_000 // 1 hour in milliseconds
const BCRYPT_ROUNDS = 10
const HEX_TOKEN_BYTES = 32
const MIN_PASSWORD_LENGTH = 8
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400

const forgotPasswordSchema = z.object({
  email: z.email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
})

const SUCCESS_MESSAGE = 'If that email exists, a reset link has been sent.'
const RESET_SUCCESS_MESSAGE = 'Password has been reset successfully.'
const INVALID_TOKEN_MESSAGE = 'Invalid or expired reset token'
const INVALID_BODY_MESSAGE = 'Invalid request body'

// Drizzle query results type as T[], but .at(0) correctly returns T | undefined
function first<T>(rows: T[]): T | undefined {
  return rows.at(0)
}

// Fastify plugin interface requires Promise<void> — eslint-disable needed because
// route registration is synchronous but the plugin signature mandates async
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin contract requires async signature
export async function passwordResetRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post(
    '/auth/forgot-password',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = forgotPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: INVALID_BODY_MESSAGE })
        return
      }
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- chained access after discriminated union narrowing
      const { email } = parsed.data

      const user = first(
        await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1),
      )

      // Always return success to avoid user enumeration
      if (user === undefined) {
        await reply.status(HTTP_OK).send({ message: SUCCESS_MESSAGE })
        return
      }

      const token = crypto.randomBytes(HEX_TOKEN_BYTES).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      })

      // In production, send via email. Log token for development/testing.
      fastify.log.info({ token, email }, 'Password reset token generated')

      await reply.status(HTTP_OK).send({ message: SUCCESS_MESSAGE })
    },
  )

  fastify.post(
    '/auth/reset-password',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = resetPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: INVALID_BODY_MESSAGE })
        return
      }
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- chained access after discriminated union narrowing
      const { token, password } = parsed.data

      const now = new Date()

      const resetRecord = first(
        await db
          .select()
          .from(passwordResetTokens)
          .where(
            and(
              eq(passwordResetTokens.token, token),
              gt(passwordResetTokens.expiresAt, now),
            ),
          )
          .limit(1),
      )

      if (resetRecord?.usedAt !== null) {
        await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: INVALID_TOKEN_MESSAGE })
        return
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

      await db
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, resetRecord.userId))

      await db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, resetRecord.id))

      await reply.status(HTTP_OK).send({ message: RESET_SUCCESS_MESSAGE })
    },
  )
}
