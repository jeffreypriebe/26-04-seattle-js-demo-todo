import type { FastifyInstance } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { todos } from '../../db/schema'
import { createTaskBodySchema } from './schemas'

const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400

export function taskRoutes(fastify: FastifyInstance): void {
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = createTaskBodySchema.safeParse(request.body)
      if (!result.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid request body' })
      }

      const { title, due_date: dueString } = result.data
      const { id: userId } = request.user

      const existingPositions = await db
        .select({ position: todos.position })
        .from(todos)
        .where(eq(todos.userId, userId))
        .orderBy(desc(todos.position))
        .limit(1)
      const position =
        existingPositions.length > 0 ? existingPositions[0].position + 1 : 0

      const dueDate = dueString !== undefined ? new Date(dueString) : null

      const [created] = await db
        .insert(todos)
        .values({
          userId,
          title,
          dueDate: dueDate ?? undefined,
          position,
        })
        .returning()

      return await reply.status(HTTP_CREATED).send({
        id: created.id,
        title: created.title,
        due_date:
          created.dueDate !== null ? created.dueDate.toISOString() : null,
        completed: created.completed,
        position: created.position,
        created_at: created.createdAt.toISOString(),
        updated_at: created.updatedAt.toISOString(),
      })
    },
  )
}
