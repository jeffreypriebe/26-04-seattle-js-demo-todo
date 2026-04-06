import { z } from 'zod'

export const teamParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const inviteResponseSchema = z.object({
  invite_code: z.string(),
  invite_link: z.string(),
})

export type TeamParams = z.infer<typeof teamParamsSchema>
export type InviteResponse = z.infer<typeof inviteResponseSchema>
