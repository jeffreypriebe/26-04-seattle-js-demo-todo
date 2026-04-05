import { z } from 'zod'

// Shared parameter schema for routes with :id
export const taskParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// POST /tasks — create a personal task
export const createTaskBodySchema = z.object({
  title: z.string().min(1),
  due_date: z.iso.datetime().optional(),
})

// GET /tasks — list tasks with optional filter
export const listTasksQuerySchema = z.object({
  has_due_date: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
})

// PATCH /tasks/:id — toggle completed
export const updateTaskBodySchema = z.object({
  completed: z.boolean(),
})

// PATCH /tasks/:id/position — update position
export const updateTaskPositionBodySchema = z.object({
  position: z.number().int().nonnegative(),
})

// Shared task shape returned in all responses
export const taskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  due_date: z.iso.datetime().nullable(),
  completed: z.boolean(),
  position: z.number().int().nonnegative(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
})

export type Task = z.infer<typeof taskSchema>
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>
export type UpdateTaskPositionBody = z.infer<
  typeof updateTaskPositionBodySchema
>
export type TaskParams = z.infer<typeof taskParamsSchema>
