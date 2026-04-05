import Fastify from 'fastify'
import { passwordResetRoutes } from './auth/password-reset'

export function buildServer(): ReturnType<typeof Fastify> {
  const fastify = Fastify({ logger: true })

  fastify.register(passwordResetRoutes)

  return fastify
}
