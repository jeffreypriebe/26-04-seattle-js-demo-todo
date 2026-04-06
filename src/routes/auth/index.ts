import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { users, refreshTokens } from '../../db/schema'

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60 // 15 minutes
const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8

const signupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
})

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const HTTP_CREATED = 201

  fastify.post('/signup', async (request, reply) => {
    const result = signupBodySchema.safeParse(request.body)
    if (!result.success) {
      return await reply.status(400).send({ error: 'Invalid request body' })
    }
    const { email, password } = result.data

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing) {
      return await reply.status(409).send({ error: 'Email already in use' })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email })

    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    )

    const refreshToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(refreshToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: REFRESH_TOKEN_TTL_MS / 1000,
    })

    return await reply
      .status(HTTP_CREATED)
      .send({ accessToken, user: { id: user.id, email: user.email } })
  })

  fastify.post('/login', async (request, reply) => {
    const result = loginBodySchema.safeParse(request.body)
    if (!result.success) {
      return await reply.status(400).send({ error: 'Invalid request body' })
    }
    const { email, password } = result.data

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (!user) {
      return await reply.status(401).send({ error: 'Invalid credentials' })
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      return await reply.status(401).send({ error: 'Invalid credentials' })
    }

    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    )

    const refreshToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(refreshToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: REFRESH_TOKEN_TTL_MS / 1000,
    })

    return await reply.status(200).send({ accessToken })
  })

  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refresh_token
    if (!refreshToken) {
      return await reply.status(401).send({ error: 'Missing refresh token' })
    }

    const tokenHash = hashToken(refreshToken)
    const now = new Date()

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1)

    if (!stored || stored.expiresAt < now) {
      return await reply
        .status(401)
        .send({ error: 'Invalid or expired refresh token' })
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1)
    if (!user) {
      return await reply.status(401).send({ error: 'User not found' })
    }

    // Rotate: delete old token, issue new one
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))

    const newRefreshToken = crypto.randomBytes(32).toString('hex')
    const newTokenHash = hashToken(newRefreshToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt,
    })

    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    )

    reply.setCookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: REFRESH_TOKEN_TTL_MS / 1000,
    })

    return await reply.status(200).send({ accessToken })
  })

  const HTTP_NO_CONTENT = 204

  fastify.post('/logout', async (request, reply) => {
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- cookie key has underscores; destructuring alias does not improve readability over dot-notation here
    const refreshToken = request.cookies.refresh_token

    if (refreshToken !== undefined && refreshToken !== '') {
      const tokenHash = hashToken(refreshToken)
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
    }

    reply.clearCookie('refresh_token', { path: '/auth/refresh' })

    return await reply.status(HTTP_NO_CONTENT).send()
  })
}
