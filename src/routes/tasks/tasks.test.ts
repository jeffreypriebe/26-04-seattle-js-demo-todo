import { describe, it, expect, beforeAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { buildApp } from '../../app'
import { db } from '../../db/index'
import { users, todos } from '../../db/schema'
import { runMigrations } from '../../db/migrate'

const TEST_EMAIL = 'tasks-test@example.com'
const TEST_PASSWORD = 'password123'
const JWT_SECRET = 'test-secret'

async function loginAndGetToken(
  app: Awaited<ReturnType<typeof buildApp>>,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  const body = res.json() as { accessToken: string }
  return body.accessToken
}

beforeAll(async () => {
  runMigrations()
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)
  await db.delete(users).where(eq(users.email, TEST_EMAIL))
  const [user] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, passwordHash })
    .returning({ id: users.id })
  // Clean up any leftover todos for this user
  await db.delete(todos).where(eq(todos.userId, user.id))
})

describe('POST /tasks', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'My task' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 400 for missing title', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 400 for empty title', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: '' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('creates task with title only and returns 201', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Buy groceries' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as {
      id: number
      title: string
      due_date: string | null
      completed: boolean
      position: number
      created_at: string
      updated_at: string
    }
    expect(body.title).toBe('Buy groceries')
    expect(body.due_date).toBeNull()
    expect(body.completed).toBe(false)
    expect(typeof body.position).toBe('number')
    expect(typeof body.id).toBe('number')
    expect(typeof body.created_at).toBe('string')
    expect(typeof body.updated_at).toBe('string')
    await app.close()
  })

  it('creates task with optional due_date and returns it in response', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const dueDate = '2026-05-01T12:00:00.000Z'
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Submit report', due_date: dueDate },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { title: string; due_date: string | null }
    expect(body.title).toBe('Submit report')
    expect(body.due_date).toBe(dueDate)
    await app.close()
  })

  it('assigns incrementing positions to successive tasks', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)

    const res1 = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Task A' },
    })
    const res2 = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Task B' },
    })
    const body1 = res1.json() as { position: number }
    const body2 = res2.json() as { position: number }
    expect(body2.position).toBe(body1.position + 1)
    await app.close()
  })
})
