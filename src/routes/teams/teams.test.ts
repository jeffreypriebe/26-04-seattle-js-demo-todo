import { describe, it, expect, beforeAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { buildApp } from '../../app'
import { db } from '../../db/index'
import { users, teams, teamMembers } from '../../db/schema'
import { runMigrations } from '../../db/migrate'

const TEST_PASSWORD = 'password123'
const JWT_SECRET = 'test-secret'

async function createUserAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<{ accessToken: string; userId: number }> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)
  await db.delete(users).where(eq(users.email, email))
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id })
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: TEST_PASSWORD },
  })
  const body = res.json()
  return { accessToken: body.accessToken, userId: user.id }
}

beforeAll(async () => {
  runMigrations()
})

describe('POST /teams', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      payload: { name: 'My Team' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 400 when name is missing', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const { accessToken } = await createUserAndLogin(
      app,
      `team-no-name-${Date.now()}@example.com`,
    )
    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('creates a team and returns 201 with invite code', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const email = `team-create-${Date.now()}@example.com`
    const { accessToken, userId } = await createUserAndLogin(app, email)

    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Test Team' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.name).toBe('Test Team')
    expect(typeof body.invite_code).toBe('string')
    expect(body.invite_code.length).toBeGreaterThan(0)
    expect(typeof body.id).toBe('number')
    expect(typeof body.created_at).toBe('string')

    // Verify user was added as a member
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1)
    expect(membership).toBeDefined()
    expect(membership.teamId).toBe(body.id)

    await app.close()
  })

  it('returns 409 when user is already a member of a team', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const email = `team-double-${Date.now()}@example.com`
    const { accessToken, userId } = await createUserAndLogin(app, email)

    // Create a team first
    const [team] = await db
      .insert(teams)
      .values({ name: 'Existing Team', inviteCode: `EXIST${userId}` })
      .returning({ id: teams.id })
    await db.insert(teamMembers).values({ teamId: team.id, userId })

    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Another Team' },
    })

    expect(res.statusCode).toBe(409)
    await app.close()
  })
})

describe('GET /teams/me', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/teams/me' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns null when user has no team', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const { accessToken } = await createUserAndLogin(
      app,
      `team-me-none-${Date.now()}@example.com`,
    )
    const res = await app.inject({
      method: 'GET',
      url: '/teams/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toBeNull()
    await app.close()
  })

  it('returns team info when user has a team', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const email = `team-me-has-${Date.now()}@example.com`
    const { accessToken } = await createUserAndLogin(app, email)

    // Create team via POST
    await app.inject({
      method: 'POST',
      url: '/teams',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'My Team' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/teams/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('My Team')
    expect(typeof body.invite_code).toBe('string')
    await app.close()
  })
})
