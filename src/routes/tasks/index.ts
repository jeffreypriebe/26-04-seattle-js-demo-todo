import type { FastifyInstance } from 'fastify'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '../../db/index'
import { todos } from '../../db/schema'
import {
  createTaskBodySchema,
  listTasksQuerySchema,
  taskParamsSchema,
  updateTaskBodySchema,
  updateTaskPositionBodySchema,
} from './schemas'

const HTTP_OK = 200
const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404

export function taskRoutes(fastify: FastifyInstance): void {
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = listTasksQuerySchema.safeParse(request.query)
      if (!result.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid query parameters' })
      }

      const hasDueDate = result.data.has_due_date
      const userId = request.user.id

      const baseQuery = db.select().from(todos)
      const tasks = await (hasDueDate === true
        ? baseQuery.where(
            and(eq(todos.userId, userId), isNotNull(todos.dueDate)),
          )
        : baseQuery.where(eq(todos.userId, userId)))

      // Sort: tasks with due_date ASC first, nulls last
      tasks.sort((a, b) => {
        if (a.dueDate === null && b.dueDate === null) return 0
        if (a.dueDate === null) return 1
        if (b.dueDate === null) return -1
        return a.dueDate.getTime() - b.dueDate.getTime()
      })

      return await reply.send(
        tasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.dueDate !== null ? t.dueDate.toISOString() : null,
          completed: t.completed,
          position: t.position,
          created_at: t.createdAt.toISOString(),
          updated_at: t.updatedAt.toISOString(),
        })),
      )
    },
  )

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

  fastify.patch(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = taskParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid task id' })
      }

      const bodyResult = updateTaskBodySchema.safeParse(request.body)
      if (!bodyResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid request body' })
      }

      const { id: taskId } = paramsResult.data
      const { completed } = bodyResult.data
      const { id: userId } = request.user

      const [task] = await db
        .select()
        .from(todos)
        .where(eq(todos.id, taskId))
        .limit(1)

      if (!task) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Task not found' })
      }

      if (task.userId !== userId) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const [updated] = await db
        .update(todos)
        .set({ completed, updatedAt: new Date() })
        .where(eq(todos.id, taskId))
        .returning()

      return await reply.status(HTTP_OK).send({
        id: updated.id,
        title: updated.title,
        due_date:
          updated.dueDate !== null ? updated.dueDate.toISOString() : null,
        completed: updated.completed,
        position: updated.position,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      })
    },
  )

  fastify.patch(
    '/:id/position',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = taskParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid task id' })
      }

      const bodyResult = updateTaskPositionBodySchema.safeParse(request.body)
      if (!bodyResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid request body' })
      }

      const { id: taskId } = paramsResult.data
      const { position } = bodyResult.data
      const { id: userId } = request.user

      const [task] = await db
        .select()
        .from(todos)
        .where(eq(todos.id, taskId))
        .limit(1)

      if (!task) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Task not found' })
      }

      if (task.userId !== userId) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      const [updated] = await db
        .update(todos)
        .set({ position, updatedAt: new Date() })
        .where(eq(todos.id, taskId))
        .returning()

      return await reply.status(HTTP_OK).send({
        id: updated.id,
        title: updated.title,
        due_date:
          updated.dueDate !== null ? updated.dueDate.toISOString() : null,
        completed: updated.completed,
        position: updated.position,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      })
    },
  )

  fastify.delete(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const paramsResult = taskParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return await reply
          .status(HTTP_BAD_REQUEST)
          .send({ error: 'Invalid task id' })
      }

      const { id: taskId } = paramsResult.data
      const { id: userId } = request.user

      const [task] = await db
        .select()
        .from(todos)
        .where(eq(todos.id, taskId))
        .limit(1)

      if (!task) {
        return await reply
          .status(HTTP_NOT_FOUND)
          .send({ error: 'Task not found' })
      }

      if (task.userId !== userId) {
        return await reply.status(HTTP_FORBIDDEN).send({ error: 'Forbidden' })
      }

      await db.delete(todos).where(eq(todos.id, taskId))

      return await reply.status(HTTP_OK).send({ id: taskId })
    },
  )
}
