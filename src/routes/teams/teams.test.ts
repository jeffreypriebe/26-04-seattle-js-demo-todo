import { describe, it, expect, beforeAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { buildApp } from '../../app'
import { db } from '../../db/index'
import { users, teams, teamMembers, teamTasks } from '../../db/schema'
import { runMigrations } from '../../db/migrate'

const TEST_PASSWORD = 'password123'
const JWT_SECRET = 'test-secret'

// Shared state for invite tests
const TEST_EMAIL = 'team-invite-test@example.com'
const OTHER_EMAIL = 'team-invite-other@example.com'
const TEST_INVITE_CODE = 'test-invite-code-abc123'
let testTeamId: number

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

async function loginAndGetToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  })
  return res.json().accessToken as string
}

beforeAll(async () => {
  runMigrations()

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)

  await db.delete(users).where(eq(users.email, TEST_EMAIL))
  const [user] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, passwordHash })
    .returning({ id: users.id })

  await db.delete(users).where(eq(users.email, OTHER_EMAIL))
  await db
    .insert(users)
    .values({ email: OTHER_EMAIL, passwordHash })
    .returning({ id: users.id })

  // Delete any leftover team with this invite code
  await db.delete(teams).where(eq(teams.inviteCode, TEST_INVITE_CODE))

  const [team] = await db
    .insert(teams)
    .values({ name: 'Test Team', inviteCode: TEST_INVITE_CODE })
    .returning({ id: teams.id })
  testTeamId = team.id

  // Add testUser as member, but NOT otherUser
  await db.delete(teamMembers).where(eq(teamMembers.teamId, testTeamId))
  await db.insert(teamMembers).values({ teamId: testTeamId, userId: user.id })
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

describe('POST /teams/join', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/teams/join',
      payload: { code: TEST_INVITE_CODE },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 400 when code is missing', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const { accessToken } = await createUserAndLogin(
      app,
      `join-no-code-${Date.now()}@example.com`,
    )
    const res = await app.inject({
      method: 'POST',
      url: '/teams/join',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 for unknown invite code', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const { accessToken } = await createUserAndLogin(
      app,
      `join-bad-code-${Date.now()}@example.com`,
    )
    const res = await app.inject({
      method: 'POST',
      url: '/teams/join',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'NONEXISTENT' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 409 when user is already a member of a team', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    // TEST_EMAIL user is already a member of testTeamId
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'POST',
      url: '/teams/join',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: TEST_INVITE_CODE },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('joins team and returns 200 with team info', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const email = `join-success-${Date.now()}@example.com`
    const { accessToken, userId } = await createUserAndLogin(app, email)

    const res = await app.inject({
      method: 'POST',
      url: '/teams/join',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: TEST_INVITE_CODE },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(testTeamId)
    expect(body.name).toBe('Test Team')
    expect(body.invite_code).toBe(TEST_INVITE_CODE)

    // Verify membership was created
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.teamId, testTeamId), eq(teamMembers.userId, userId)),
      )
      .limit(1)
    expect(membership).toBeDefined()

    // Cleanup
    await db
      .delete(teamMembers)
      .where(
        and(eq(teamMembers.teamId, testTeamId), eq(teamMembers.userId, userId)),
      )

    await app.close()
  })
})

describe('GET /teams/:id/invite', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/invite`,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 400 for invalid team id', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'GET',
      url: '/teams/not-a-number/invite',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 for non-existent team', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'GET',
      url: '/teams/999999/invite',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 403 when user is not a team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/invite`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns invite_code and invite_link for team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/invite`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.invite_code).toBe(TEST_INVITE_CODE)
    expect(body.invite_link).toContain(TEST_INVITE_CODE)
    expect(body.invite_link).toContain('/join?code=')
    await app.close()
  })
})

describe('GET /teams/:id/tasks', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/tasks`,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 403 when user is not a team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns 404 for non-existent team', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'GET',
      url: '/teams/999999/tasks',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns empty array when team has no tasks', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    await db.delete(teamTasks).where(eq(teamTasks.teamId, testTeamId))
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
    await app.close()
  })

  it('returns tasks with creator_name for team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)

    // Get the test user id
    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1)

    await db.delete(teamTasks).where(eq(teamTasks.teamId, testTeamId))
    await db.insert(teamTasks).values({
      teamId: testTeamId,
      createdByUserId: testUser.id,
      title: 'Test task',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Test task')
    expect(body[0].creator_name).toBe(TEST_EMAIL)
    await app.close()
  })
})

describe('POST /teams/:id/tasks', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${testTeamId}/tasks`,
      payload: { title: 'New task' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 403 when user is not a team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New task' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns 400 when title is missing', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('creates a task and returns 201 with creator_name', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Created via API' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.title).toBe('Created via API')
    expect(body.creator_name).toBe(TEST_EMAIL)
    expect(body.completed).toBe(false)
    expect(typeof body.id).toBe('number')
    await app.close()
  })

  it('all team members see the same task pool', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()

    // Add OTHER_EMAIL as a member of the test team temporarily
    const [otherUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, OTHER_EMAIL))
      .limit(1)
    await db
      .insert(teamMembers)
      .values({ teamId: testTeamId, userId: otherUser.id })
      .onConflictDoNothing()

    const memberToken = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const otherToken = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)

    // Create a task as the main member
    await app.inject({
      method: 'POST',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { title: 'Shared task' },
    })

    // Both members should see the same tasks
    const res1 = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${memberToken}` },
    })
    const res2 = await app.inject({
      method: 'GET',
      url: `/teams/${testTeamId}/tasks`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(200)
    const tasks1 = res1.json()
    const tasks2 = res2.json()
    expect(tasks1.map(t => t.id).sort()).toEqual(tasks2.map(t => t.id).sort())

    // Clean up: remove otherUser from the team
    await db.delete(teamMembers).where(eq(teamMembers.teamId, testTeamId))
    await db.insert(teamMembers).values({
      teamId: testTeamId,
      userId: (
        await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, TEST_EMAIL))
          .limit(1)
      )[0].id,
    })

    await app.close()
  })
})

describe('PATCH /teams/:id/tasks/:taskId', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: `/teams/${testTeamId}/tasks/1`,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 403 when user is not a team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'PATCH',
      url: `/teams/${testTeamId}/tasks/1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns 404 for non-existent task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'PATCH',
      url: `/teams/${testTeamId}/tasks/999999`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('toggles task completed status', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)

    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1)

    await db.delete(teamTasks).where(eq(teamTasks.teamId, testTeamId))
    const [task] = await db
      .insert(teamTasks)
      .values({
        teamId: testTeamId,
        createdByUserId: testUser.id,
        title: 'Toggle me',
      })
      .returning()

    expect(task.completed).toBe(false)

    const res1 = await app.inject({
      method: 'PATCH',
      url: `/teams/${testTeamId}/tasks/${task.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res1.statusCode).toBe(200)
    expect(res1.json().completed).toBe(true)

    const res2 = await app.inject({
      method: 'PATCH',
      url: `/teams/${testTeamId}/tasks/${task.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res2.statusCode).toBe(200)
    expect(res2.json().completed).toBe(false)

    await app.close()
  })

  it('any team member can toggle any task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()

    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1)
    const [otherUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, OTHER_EMAIL))
      .limit(1)

    await db
      .insert(teamMembers)
      .values({ teamId: testTeamId, userId: otherUser.id })
      .onConflictDoNothing()

    await db.delete(teamTasks).where(eq(teamTasks.teamId, testTeamId))
    const [task] = await db
      .insert(teamTasks)
      .values({
        teamId: testTeamId,
        createdByUserId: testUser.id,
        title: 'Member toggle',
      })
      .returning()

    const otherToken = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'PATCH',
      url: `/teams/${testTeamId}/tasks/${task.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().completed).toBe(true)

    await db.delete(teamMembers).where(eq(teamMembers.userId, otherUser.id))
    await app.close()
  })
})

describe('DELETE /teams/:id/tasks/:taskId', () => {
  it('returns 401 when no auth token', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${testTeamId}/tasks/1`,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 403 when user is not a team member', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${testTeamId}/tasks/1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('returns 404 for non-existent task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${testTeamId}/tasks/999999`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('deletes the task and returns 200 with id', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()
    const token = await loginAndGetToken(app, TEST_EMAIL, TEST_PASSWORD)

    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1)

    const [task] = await db
      .insert(teamTasks)
      .values({
        teamId: testTeamId,
        createdByUserId: testUser.id,
        title: 'Delete me',
      })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${testTeamId}/tasks/${task.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(task.id)

    const [deleted] = await db
      .select()
      .from(teamTasks)
      .where(eq(teamTasks.id, task.id))
      .limit(1)
    expect(deleted).toBeUndefined()

    await app.close()
  })

  it('any team member can delete any task', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET })
    await app.ready()

    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1)
    const [otherUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, OTHER_EMAIL))
      .limit(1)

    await db
      .insert(teamMembers)
      .values({ teamId: testTeamId, userId: otherUser.id })
      .onConflictDoNothing()

    const [task] = await db
      .insert(teamTasks)
      .values({
        teamId: testTeamId,
        createdByUserId: testUser.id,
        title: 'Other deletes me',
      })
      .returning()

    const otherToken = await loginAndGetToken(app, OTHER_EMAIL, TEST_PASSWORD)
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${testTeamId}/tasks/${task.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(200)

    await db.delete(teamMembers).where(eq(teamMembers.userId, otherUser.id))
    await app.close()
  })
})
