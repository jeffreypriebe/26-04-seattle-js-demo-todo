import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; email: string }
    user: { id: number; email: string }
  }
}

const HTTP_UNAUTHORIZED = 401

function authenticatePlugin(
  fastify: FastifyInstance,
  _opts: object,
  done: () => void,
): void {
  fastify.decorate(
    'authenticate',
    async function authenticate(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        const payload = await request.jwtVerify<{
          sub: number
          email: string
        }>()
        request.user = { id: payload.sub, email: payload.email }
      } catch {
        await reply.status(HTTP_UNAUTHORIZED).send({ error: 'Unauthorized' })
      }
    },
  )
  done()
}

export const authenticateDecorator = fp(authenticatePlugin)
