import Fastify from 'fastify'
import jwtPlugin from '@fastify/jwt'
import cookiePlugin from '@fastify/cookie'
import { authRoutes } from './routes/auth/index'

export function buildApp(
  opts: { jwtSecret?: string; logger?: boolean } = {},
): ReturnType<typeof Fastify> {
  const fastify = Fastify({ logger: opts.logger ?? false })

  fastify.register(cookiePlugin)
  fastify.register(jwtPlugin, {
    secret: opts.jwtSecret ?? process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  fastify.register(authRoutes, { prefix: '/auth' })

  return fastify
}
