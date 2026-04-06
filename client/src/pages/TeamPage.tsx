import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface InviteData {
  invite_code: string
  invite_link: string
}

async function fetchTeamInvite(teamId: number): Promise<InviteData> {
  const res = await apiFetch(`/teams/${teamId}/invite`)
  if (!res.ok) throw new Error('Failed to fetch invite')
  return res.json() as Promise<InviteData>
}

// Temporary: hardcoded team ID until team selection is implemented
const TEAM_ID = 1

export function TeamPage() {
  const [copied, setCopied] = React.useState<'code' | 'link' | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-invite', TEAM_ID],
    queryFn: () => fetchTeamInvite(TEAM_ID),
    retry: false,
  })

  async function copyToClipboard(text: string, type: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-6">Team</h1>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Invite to team
        </h2>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading invite…</p>
        )}

        {isError && (
          <p className="text-sm text-destructive">
            Could not load invite details.
          </p>
        )}

        {data && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            {/* Invite code row */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Invite code
                </p>
                <p className="font-mono text-sm font-medium tracking-wide truncate">
                  {data.invite_code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(data.invite_code, 'code')}
                aria-label="Copy invite code"
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {copied === 'code' ? 'Copied!' : 'Copy code'}
              </button>
            </div>

            {/* Invite link row */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Invite link
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {data.invite_link}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(data.invite_link, 'link')}
                aria-label="Copy invite link"
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {copied === 'link' ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
