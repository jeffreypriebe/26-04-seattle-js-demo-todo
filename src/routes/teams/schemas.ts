import { z } from 'zod'

export const teamParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const teamTaskParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
})

export const inviteResponseSchema = z.object({
  invite_code: z.string(),
  invite_link: z.string(),
})

export const createTeamTaskBodySchema = z.object({
  title: z.string().min(1),
})

export type TeamParams = z.infer<typeof teamParamsSchema>
export type TeamTaskParams = z.infer<typeof teamTaskParamsSchema>
export type InviteResponse = z.infer<typeof inviteResponseSchema>
export type CreateTeamTaskBody = z.infer<typeof createTeamTaskBodySchema>
