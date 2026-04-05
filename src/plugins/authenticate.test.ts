import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import cookiePlugin from '@fastify/cookie'
import { authenticateDecorator } from './authenticate'
import { runMigrations } from '../db/migrate'

const JWT_SECRET = 'test-secret'
const HTTP_OK = 200
const HTTP_UNAUTHORIZED = 401
const TEST_USER_ID = 42

async function buildTestApp(): Promise<ReturnType<typeof Fastify>> {
  runMigrations()
  const app = Fastify({ logger: false })

  app.register(cookiePlugin)
  app.register(jwtPlugin, { secret: JWT_SECRET })
  app.register(authenticateDecorator)

  app.after(() => {
    app.get(
      '/protected',
      { preHandler: [app.authenticate] },
      async request => await Promise.resolve({ userId: request.user.id }),
    )
  })

  return await app.ready().then(() => app)
}

describe('authenticate preHandler', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/protected' })
    expect(res.statusCode).toBe(HTTP_UNAUTHORIZED)
    await app.close()
  })

  it('returns 401 for an invalid token', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
    })
    expect(res.statusCode).toBe(HTTP_UNAUTHORIZED)
    await app.close()
  })

  it('returns 401 for a token signed with a different secret', async () => {
    const otherApp = Fastify({ logger: false })
    otherApp.register(jwtPlugin, { secret: 'wrong-secret' })
    await otherApp.ready()
    const token = otherApp.jwt.sign({ sub: 1, email: 'a@b.com' })
    await otherApp.close()

    const app = await buildTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(HTTP_UNAUTHORIZED)
    await app.close()
  })

  it('grants access and attaches user.id for a valid token', async () => {
    const app = await buildTestApp()
    const token = app.jwt.sign({ sub: TEST_USER_ID, email: 'user@example.com' })
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(HTTP_OK)
    const body = res.json() as { userId: number }
    expect(body.userId).toBe(TEST_USER_ID)
    await app.close()
  })

  it('returns 401 for an expired token', async () => {
    const app = await buildTestApp()
    // expiresIn: -1 creates an already-expired token (exp = now - 1s)
    const token = app.jwt.sign({ sub: 1, email: 'a@b.com' }, { expiresIn: -1 })
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(HTTP_UNAUTHORIZED)
    await app.close()
  })
})
