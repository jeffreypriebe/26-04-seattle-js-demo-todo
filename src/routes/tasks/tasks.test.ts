import { describe, it, expect, beforeAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { buildApp } from '../../app'
import { db } from '../../db/index'
import { users, todos } from '../../db/schema'
import { runMigrations } from '../../db/migrate'

const TEST_EMAIL = 'tasks-test@example.com'
const TEST_PASSWORD = 'password123'
const OTHER_EMAIL = 'tasks-other@example.com'
const OTHER_PASSWORD = 'other-password123'
const JWT_SECRET = 'test-secret'

async function loginAndGetToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
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

  const otherPasswordHash = await bcrypt.hash(OTHER_PASSWORD, 10)
  await db.delete(users).where(eq(users.email, OTHER_EMAIL))
  await db.insert(users).values({ email: OTHER_EMAIL, passwordHash: otherPasswordHash })
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

describe('PATCH /tasks/:id', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/tasks/1',
      payload: { completed: true },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 400 for invalid body (missing completed)', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    // Create a task first
    const created = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Patch test task' },
    })
    const { id } = created.json() as { id: number }
    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('toggles completed to true and returns updated task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const created = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Toggle me' },
    })
    const { id } = created.json() as { id: number }
    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { completed: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { id: number; completed: boolean }
    expect(body.id).toBe(id)
    expect(body.completed).toBe(true)
    await app.close()
  })

  it('returns 403 when patching another user\'s task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const ownerToken = await loginAndGetToken(app)
    const otherToken = await loginAndGetToken(app, OTHER_EMAIL, OTHER_PASSWORD)

    const created = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Owner task' },
    })
    const { id } = created.json() as { id: number }

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { completed: true },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns 404 for non-existent task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'PATCH',
      url: '/tasks/999999',
      headers: { authorization: `Bearer ${token}` },
      payload: { completed: true },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('DELETE /tasks/:id', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'DELETE',
      url: '/tasks/1',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('deletes a task and returns 200 with id', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const created = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Delete me' },
    })
    const { id } = created.json() as { id: number }
    const res = await app.inject({
      method: 'DELETE',
      url: `/tasks/${id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { id: number }
    expect(body.id).toBe(id)
    await app.close()
  })

  it('returns 403 when deleting another user\'s task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const ownerToken = await loginAndGetToken(app)
    const otherToken = await loginAndGetToken(app, OTHER_EMAIL, OTHER_PASSWORD)

    const created = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Cannot delete this' },
    })
    const { id } = created.json() as { id: number }

    const res = await app.inject({
      method: 'DELETE',
      url: `/tasks/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns 404 for non-existent task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app)
    const res = await app.inject({
      method: 'DELETE',
      url: '/tasks/999999',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
