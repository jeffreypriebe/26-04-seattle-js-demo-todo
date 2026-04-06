import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { buildApp } from '../../app'
import { db, sqlite } from '../../db/index'
import { users, refreshTokens } from '../../db/schema'
import { runMigrations } from '../../db/migrate'

const TEST_EMAIL = 'testuser@example.com'
const TEST_PASSWORD = 'password123'
const JWT_SECRET = 'test-secret'

beforeAll(async () => {
  runMigrations()
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)
  // Remove existing test user if present (idempotent setup)
  await db.delete(users).where(eq(users.email, TEST_EMAIL))
  await db.insert(users).values({ email: TEST_EMAIL, passwordHash })
})

describe('POST /auth/login', () => {
  it('returns 400 for invalid body', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'not-an-email', password: '' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 401 for unknown email', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'whatever' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 for wrong password', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns accessToken and sets HttpOnly refresh_token cookie on success', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.accessToken).toBe('string')
    expect(body.accessToken.length).toBeGreaterThan(0)

    const cookieHeader = res.headers['set-cookie']
    expect(cookieHeader).toBeDefined()
    const cookieStr = Array.isArray(cookieHeader)
      ? cookieHeader.join('; ')
      : cookieHeader
    expect(cookieStr).toContain('refresh_token=')
    expect(cookieStr.toLowerCase()).toContain('httponly')
    await app.close()
  })
})

describe('POST /auth/refresh', () => {
  it('returns 401 when no refresh token cookie', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 for invalid refresh token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'fake-token-that-does-not-exist' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('issues new accessToken and rotates refresh token cookie', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()

    // Login first to get a valid refresh token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(loginRes.statusCode).toBe(200)

    const cookieHeader = loginRes.headers['set-cookie']
    const cookieStr = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : cookieHeader
    const tokenMatch = /refresh_token=([^;]+)/.exec(cookieStr)
    expect(tokenMatch).not.toBeNull()
    const refreshToken = tokenMatch![1]

    // Use refresh token to get new access token
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: refreshToken },
    })
    expect(refreshRes.statusCode).toBe(200)
    const refreshBody = refreshRes.json()
    expect(typeof refreshBody.accessToken).toBe('string')
    expect(refreshBody.accessToken.length).toBeGreaterThan(0)

    // New refresh token cookie must be set
    const newCookieHeader = refreshRes.headers['set-cookie']
    expect(newCookieHeader).toBeDefined()
    const newCookieStr = Array.isArray(newCookieHeader)
      ? newCookieHeader[0]
      : newCookieHeader
    expect(newCookieStr).toContain('refresh_token=')

    // Old refresh token must be invalidated (rotation)
    const replayRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: refreshToken },
    })
    expect(replayRes.statusCode).toBe(401)

    await app.close()
  })

  it('returns 401 when refresh token exists but user has been deleted', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()

    // Insert a user, grab their id, insert a valid refresh token, then delete the user
    const passwordHash = await bcrypt.hash('password123', 10)
    const [user] = await db
      .insert(users)
      .values({ email: 'deleted-user@example.com', passwordHash })
      .returning({ id: users.id })

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    // Delete user and re-insert the orphaned token with FK checks off
    sqlite.pragma('foreign_keys = OFF')
    await db.delete(users).where(eq(users.id, user.id))
    sqlite.pragma('foreign_keys = ON')

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: rawToken },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json<{ error: string }>().error).toBe('User not found')

    await app.close()
  })
})

describe('POST /auth/logout', () => {
  it('returns 204 and clears the refresh_token cookie', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()

    // Login to get a real refresh token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(loginRes.statusCode).toBe(200)

    const loginCookie = loginRes.headers['set-cookie']
    const loginCookieStr = Array.isArray(loginCookie)
      ? loginCookie[0]
      : loginCookie
    const tokenMatch = /refresh_token=([^;]+)/.exec(loginCookieStr)
    expect(tokenMatch).not.toBeNull()
    const refreshToken = tokenMatch![1]

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { refresh_token: refreshToken },
    })
    expect(logoutRes.statusCode).toBe(204)

    // Cookie must be cleared
    const setCookie = logoutRes.headers['set-cookie']
    const logoutCookieStr = Array.isArray(setCookie)
      ? setCookie.join('; ')
      : (setCookie ?? '')
    expect(logoutCookieStr).toContain('refresh_token=')
    expect(logoutCookieStr.toLowerCase()).toMatch(/max-age=0|expires=.*1970/)

    // Subsequent refresh must return 401
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: refreshToken },
    })
    expect(refreshRes.statusCode).toBe(401)

    await app.close()
  })

  it('returns 204 when called without a refresh_token cookie', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    })
    expect(res.statusCode).toBe(204)
    await app.close()
  })

  it('returns 204 even when the token is not in the DB (already expired or used)', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { refresh_token: 'unknown-token-value' },
    })
    expect(res.statusCode).toBe(204)
    await app.close()
  })
})

describe('POST /auth/signup', () => {
  const SIGNUP_EMAIL = 'signup-test@example.com'

  afterEach(async () => {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, SIGNUP_EMAIL))
    for (const row of rows) {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, row.id))
    }
    await db.delete(users).where(eq(users.email, SIGNUP_EMAIL))
  })

  it('returns 201 with accessToken and user on success', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: SIGNUP_EMAIL, password: 'password123' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(typeof body.accessToken).toBe('string')
    expect(body.accessToken.length).toBeGreaterThan(0)
    expect(body.user.email).toBe(SIGNUP_EMAIL)
    expect(body.user.id).toBeGreaterThan(0)
    await app.close()
  })

  it('sets an HttpOnly refresh_token cookie', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: SIGNUP_EMAIL, password: 'password123' },
    })
    expect(res.statusCode).toBe(201)
    const cookieHeader = res.headers['set-cookie']
    expect(cookieHeader).toBeDefined()
    const cookieStr = Array.isArray(cookieHeader)
      ? cookieHeader.join('; ')
      : cookieHeader
    expect(cookieStr).toContain('refresh_token=')
    expect(cookieStr.toLowerCase()).toContain('httponly')
    await app.close()
  })

  it('stores the password as a bcrypt hash, not plaintext', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: SIGNUP_EMAIL, password: 'mypassword8' },
    })
    const [stored] = await db
      .select()
      .from(users)
      .where(eq(users.email, SIGNUP_EMAIL))
      .limit(1)
    expect(stored).toBeDefined()
    expect(stored.passwordHash).not.toBe('mypassword8')
    expect(stored.passwordHash.startsWith('$2')).toBe(true)
    await app.close()
  })

  it('returns 409 on duplicate email', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: SIGNUP_EMAIL, password: 'password123' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: SIGNUP_EMAIL, password: 'password123' },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('returns 400 for invalid email', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'not-an-email', password: 'password123' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 400 for password shorter than 8 characters', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: SIGNUP_EMAIL, password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
