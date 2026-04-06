import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { teams, teamMembers } from '../../db/schema'

const HTTP_OK = 200
const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400
const HTTP_CONFLICT = 409

const createTeamBodySchema = z.object({
  name: z.string().min(1),
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
}
