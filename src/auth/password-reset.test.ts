import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../server'
import { db } from '../db/index'
import { users, passwordResetTokens } from '../db/schema'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { eq } from 'drizzle-orm'

// Run migrations on the in-memory DB before tests
migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') })

const BCRYPT_ROUNDS = 10
const HEX_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MS = 3_600_000
const ONE_SECOND_MS = 1000
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400

async function createUser(email: string, password: string): Promise<number> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const result = db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id })
    .get()
  return result.id
}

describe('POST /auth/forgot-password', () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- reassigned in beforeEach
  let server: FastifyInstance

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- buildServer returns typed FastifyInstance
    server = buildServer()
    db.delete(passwordResetTokens).run()
    db.delete(users).run()
  })

  afterEach(async () => {
    await server.close()
  })

  it('returns 200 with success message for existing email', async () => {
    await createUser('test@example.com', 'password123')

    const response = await server.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'test@example.com' },
    })

    expect(response.statusCode).toBe(HTTP_OK)
    expect(JSON.parse(response.body) as unknown).toMatchObject({
      message: 'If that email exists, a reset link has been sent.',
    })
  })

  it('inserts a reset token for existing user', async () => {
    const userId = await createUser('test@example.com', 'password123')

    await server.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'test@example.com' },
    })

    const tokens = db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId))
      .all()
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.usedAt).toBeNull()
    expect(tokens[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns 200 for unknown email without leaking user existence', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nobody@example.com' },
    })

    expect(response.statusCode).toBe(HTTP_OK)
    expect(JSON.parse(response.body) as unknown).toMatchObject({
      message: 'If that email exists, a reset link has been sent.',
    })
  })

  it('does not insert tokens for unknown email', async () => {
    await server.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nobody@example.com' },
    })

    const tokens = db.select().from(passwordResetTokens).all()
    expect(tokens).toHaveLength(0)
  })

  it('returns 400 for invalid email format', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'not-an-email' },
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
  })

  it('returns 400 when email field is missing', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: {},
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
  })
})

describe('POST /auth/reset-password', () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- reassigned in beforeEach
  let server: FastifyInstance

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- buildServer returns typed FastifyInstance
    server = buildServer()
    db.delete(passwordResetTokens).run()
    db.delete(users).run()
  })

  afterEach(async () => {
    await server.close()
  })

  function insertResetToken(
    userId: number,
    opts: { expiresAt?: Date; usedAt?: Date } = {},
  ): string {
    const token = crypto.randomBytes(HEX_TOKEN_BYTES).toString('hex')
    const expiresAt =
      opts.expiresAt ?? new Date(Date.now() + RESET_TOKEN_TTL_MS)
    db.insert(passwordResetTokens)
      .values({ userId, token, expiresAt, usedAt: opts.usedAt })
      .run()
    return token
  }

  it('resets password and returns 200', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId)

    const response = await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'newpassword123' },
    })

    expect(response.statusCode).toBe(HTTP_OK)
    expect(JSON.parse(response.body) as unknown).toMatchObject({
      message: 'Password has been reset successfully.',
    })
  })

  it('updates the password hash in the database', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId)

    await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'newpassword123' },
    })

    const row = db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .get()
    const matches = await bcrypt.compare(
      'newpassword123',
      row?.passwordHash ?? '',
    )
    expect(matches).toBe(true)
  })

  it('old password no longer matches after reset', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId)

    await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'newpassword123' },
    })

    const row = db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .get()
    const oldMatches = await bcrypt.compare(
      'oldpassword',
      row?.passwordHash ?? '',
    )
    expect(oldMatches).toBe(false)
  })

  it('marks the token as used after reset', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId)

    await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'newpassword123' },
    })

    const record = db.select().from(passwordResetTokens).get()
    expect(record?.usedAt).not.toBeNull()
  })

  it('returns 400 for expired token', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId, {
      expiresAt: new Date(Date.now() - ONE_SECOND_MS), // expired 1 second ago
    })

    const response = await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'newpassword123' },
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
    expect(JSON.parse(response.body) as unknown).toMatchObject({
      error: 'Invalid or expired reset token',
    })
  })

  it('returns 400 for already-used token', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId, { usedAt: new Date() })

    const response = await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'newpassword123' },
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
    expect(JSON.parse(response.body) as unknown).toMatchObject({
      error: 'Invalid or expired reset token',
    })
  })

  it('returns 400 for invalid/unknown token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'nonexistenttoken', password: 'newpassword123' },
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
    expect(JSON.parse(response.body) as unknown).toMatchObject({
      error: 'Invalid or expired reset token',
    })
  })

  it('returns 400 when password is too short', async () => {
    const userId = await createUser('test@example.com', 'oldpassword')
    const token = insertResetToken(userId)

    const response = await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token, password: 'short' },
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
  })

  it('returns 400 when required fields are missing', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'sometoken' },
    })

    expect(response.statusCode).toBe(HTTP_BAD_REQUEST)
  })
})
