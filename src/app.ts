import Fastify from 'fastify'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import jwtPlugin from '@fastify/jwt'
import cookiePlugin from '@fastify/cookie'
import { authRoutes } from './routes/auth/index'
import { taskRoutes } from './routes/tasks/index'
import { authenticateDecorator } from './plugins/authenticate'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>
  }
}

export function buildApp(
  opts: { jwtSecret?: string; logger?: boolean } = {},
): FastifyInstance {
  const fastify = Fastify({ logger: opts.logger ?? false })

  fastify.register(cookiePlugin)
  fastify.register(jwtPlugin, {
    secret:
      opts.jwtSecret ??
      process.env.JWT_SECRET ??
      'dev-secret-change-in-production',
  })
  fastify.register(authenticateDecorator)

  fastify.register(authRoutes, { prefix: '/auth' })
  fastify.register(taskRoutes, { prefix: '/tasks' })

  return fastify
}
