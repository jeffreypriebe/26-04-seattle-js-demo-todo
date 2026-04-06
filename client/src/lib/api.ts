import { getAccessToken, setAccessToken, clearAccessToken } from './auth'

type RefreshResponse = { accessToken: string }

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch('/auth/refresh', { method: 'POST' })
      if (!res.ok) return null
      const data = (await res.json()) as RefreshResponse
      setAccessToken(data.accessToken)
      return data.accessToken
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Wrapper around fetch that:
 * 1. Attaches the in-memory access token as a Bearer header
 * 2. On 401, attempts a token refresh and retries once
 * 3. On refresh failure, clears the token and redirects to /login
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken()

  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })

  if (res.status !== 401) return res

  // Attempt token refresh
  const newToken = await refreshAccessToken()

  if (!newToken) {
    clearAccessToken()
    window.location.href = '/login'
    // Return the original 401 so callers can handle it if needed
    return res
  }

  // Retry the original request with the new token
  const retryHeaders = new Headers(init.headers)
  retryHeaders.set('Authorization', `Bearer ${newToken}`)
  return fetch(input, { ...init, headers: retryHeaders })
}
