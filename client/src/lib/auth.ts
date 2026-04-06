/**
 * In-memory access token store.
 * Token is never written to localStorage or sessionStorage — it lives only in memory.
 * On page reload, the app must call /auth/refresh (which uses the httpOnly cookie)
 * to re-obtain an access token.
 */
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string): void {
  accessToken = token
}

export function clearAccessToken(): void {
  accessToken = null
}
