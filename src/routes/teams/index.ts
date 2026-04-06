import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { teams, teamMembers, teamTasks, users } from '../../db/schema'
import {
  teamParamsSchema,
  teamTaskParamsSchema,
  createTeamTaskBodySchema,
} from './schemas'

const HTTP_OK = 200
const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400
const HTTP_CONFLICT = 409
const HTTP_NOT_FOUND = 404
const HTTP_FORBIDDEN = 403

const createTeamBodySchema = z.object({
  name: z.string().min(1),
})

const joinTeamBodySchema = z.object({
  code: z.string().min(1),
})

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export function teamRoutes(fastify: FastifyInstance): void {
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = createTeamBodySchema.safeParse(request.body)
      if (!result.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid request body' })
      }

      const { name } = result.data
      const { id: userId } = request.user

      // Check if user is already a member of a team
      const [existingMembership] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1)

      if (existingMembership) {
        return await reply
          .status(HTTP_CONFLICT)
          .send({ error: 'User is already a member of a team' })
      }

      // Generate a unique invite code
      let inviteCode = generateInviteCode()
      let attempts = 0
      while (attempts < 5) {
        const [existing] = await db
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.inviteCode, inviteCode))
          .limit(1)
        if (!existing) break
        inviteCode = generateInviteCode()
        attempts++
      }

      const [team] = await db
        .insert(teams)
        .values({ name, inviteCode })
        .returning()

      await db.insert(teamMembers).values({
        teamId: team.id,
        userId,
      })

      return await reply.status(HTTP_CREATED).send({
        id: team.id,
        name: team.name,
        invite_code: team.inviteCode,
        created_at: team.createdAt.toISOString(),
        updated_at: team.updatedAt.toISOString(),
      })
    },
  )

  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: userId } = request.user

      const [membership] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1)

      if (!membership) {
        return await reply.status(HTTP_OK).send(null)
      }

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, membership.teamId))
        .limit(1)

      if (!team) {
        return await reply.status(HTTP_OK).send(null)
      }

      return await reply.status(HTTP_OK).send({
        id: team.id,
        name: team.name,
        invite_code: team.inviteCode,
        created_at: team.createdAt.toISOString(),
        updated_at: team.updatedAt.toISOString(),
      })
    },
  )

  fastify.get(
    '/:id/invite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = teamParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid team id' })
      }

      const { id: teamId } = paramsResult.data
      const { id: userId } = request.user

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)

      if (!team) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Team not found' })
      }

      const [membership] = await db
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1)

      if (!membership) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const baseUrl =
        process.env.APP_BASE_URL ?? `${request.protocol}://${request.hostname}`

      return await reply.send({
        invite_code: team.inviteCode,
        invite_link: `${baseUrl}/join?code=${team.inviteCode}`,
      })
    },
  )

  fastify.get(
    '/:id/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = teamParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid team id' })
      }

      const { id: teamId } = paramsResult.data
      const { id: userId } = request.user

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)

      if (!team) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Team not found' })
      }

      const [membership] = await db
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1)

      if (!membership) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const tasks = await db
        .select({
          id: teamTasks.id,
          title: teamTasks.title,
          completed: teamTasks.completed,
          createdAt: teamTasks.createdAt,
          updatedAt: teamTasks.updatedAt,
          creatorEmail: users.email,
        })
        .from(teamTasks)
        .innerJoin(users, eq(teamTasks.createdByUserId, users.id))
        .where(eq(teamTasks.teamId, teamId))

      return await reply.status(HTTP_OK).send(
        tasks.map(t => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          creator_name: t.creatorEmail,
          created_at: t.createdAt.toISOString(),
          updated_at: t.updatedAt.toISOString(),
        })),
      )
    },
  )

  fastify.post(
    '/join',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = joinTeamBodySchema.safeParse(request.body)
      if (!result.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid request body' })
      }

      const { code } = result.data
      const { id: userId } = request.user

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.inviteCode, code))
        .limit(1)

      if (!team) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Invalid invite code' })
      }

      const [existingMembership] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1)

      if (existingMembership) {
        return await reply
          .status(HTTP_CONFLICT)
          .send({ error: 'User is already a member of a team' })
      }

      await db.insert(teamMembers).values({ teamId: team.id, userId })

      return await reply.status(HTTP_OK).send({
        id: team.id,
        name: team.name,
        invite_code: team.inviteCode,
        created_at: team.createdAt.toISOString(),
        updated_at: team.updatedAt.toISOString(),
      })
    },
  )

  fastify.post(
    '/:id/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = teamParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid team id' })
      }

      const bodyResult = createTeamTaskBodySchema.safeParse(request.body)
      if (!bodyResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid request body' })
      }

      const { id: teamId } = paramsResult.data
      const { title } = bodyResult.data
      const { id: userId } = request.user

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)

      if (!team) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Team not found' })
      }

      const [membership] = await db
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1)

      if (!membership) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const [created] = await db
        .insert(teamTasks)
        .values({ teamId, createdByUserId: userId, title })
        .returning()

      const [creator] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      return await reply.status(HTTP_CREATED).send({
        id: created.id,
        title: created.title,
        completed: created.completed,
        creator_name: creator.email,
        created_at: created.createdAt.toISOString(),
        updated_at: created.updatedAt.toISOString(),
      })
    },
  )

  fastify.patch(
    '/:id/tasks/:taskId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = teamTaskParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid params' })
      }

      const { id: teamId, taskId } = paramsResult.data
      const { id: userId } = request.user

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)

      if (!team) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Team not found' })
      }

      const [membership] = await db
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1)

      if (!membership) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const [task] = await db
        .select()
        .from(teamTasks)
        .where(and(eq(teamTasks.id, taskId), eq(teamTasks.teamId, teamId)))
        .limit(1)

      if (!task) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Task not found' })
      }

      const now = new Date()
      const [updated] = await db
        .update(teamTasks)
        .set({ completed: !task.completed, updatedAt: now })
        .where(eq(teamTasks.id, taskId))
        .returning()

      const [creator] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, updated.createdByUserId))
        .limit(1)

      return await reply.status(HTTP_OK).send({
        id: updated.id,
        title: updated.title,
        completed: updated.completed,
        creator_name: creator.email,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      })
    },
  )

  fastify.delete(
    '/:id/tasks/:taskId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = teamTaskParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid params' })
      }

      const { id: teamId, taskId } = paramsResult.data
      const { id: userId } = request.user

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1)

      if (!team) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Team not found' })
      }

      const [membership] = await db
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1)

      if (!membership) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const [task] = await db
        .select()
        .from(teamTasks)
        .where(and(eq(teamTasks.id, taskId), eq(teamTasks.teamId, teamId)))
        .limit(1)

      if (!task) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Task not found' })
      }

      await db.delete(teamTasks).where(eq(teamTasks.id, taskId))

      return await reply.status(HTTP_OK).send({ id: taskId })
    },
  )
}
