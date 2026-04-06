import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface Team {
  id: number
  name: string
  invite_code: string
  created_at: string
  updated_at: string
}

async function fetchMyTeam(): Promise<Team | null> {
  const res = await apiFetch('/teams/me')
  if (!res.ok) throw new Error('Failed to fetch team')
  return res.json() as Promise<Team | null>
}

async function createTeam(name: string): Promise<Team> {
  const res = await apiFetch('/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error ?? 'Failed to create team')
  }
  return res.json() as Promise<Team>
}

export function TeamPage() {
  const queryClient = useQueryClient()
  const [teamName, setTeamName] = React.useState('')
  const [createError, setCreateError] = React.useState<string | null>(null)

  const { data: team, isLoading } = useQuery({
    queryKey: ['team-me'],
    queryFn: fetchMyTeam,
  })

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      setTeamName('')
      setCreateError(null)
      void queryClient.invalidateQueries({ queryKey: ['team-me'] })
    },
    onError: (err: Error) => {
      setCreateError(err.message)
    },
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = teamName.trim()
    if (!trimmed) return
    createMutation.mutate(trimmed)
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">Team</h1>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (team) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">Team</h1>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Team name
            </p>
            <p className="text-sm font-medium">{team.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Invite code
            </p>
            <p className="font-mono text-sm font-semibold tracking-widest">
              {team.invite_code}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Team</h1>

      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          className="h-12 w-12 text-muted-foreground/40"
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="7" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="30" cy="18" r="7" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M6 40c0-6.627 5.373-12 12-12h12c6.627 0 12 5.373 12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-foreground">No team yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Create a team to collaborate with others.
          </p>
        </div>

        <form onSubmit={handleCreate} className="w-full max-w-xs space-y-3 mt-2">
          <input
            type="text"
            placeholder="Team name"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            aria-label="Team name"
            maxLength={100}
          />
          {createError && (
            <p className="text-xs text-destructive">{createError}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={createMutation.isPending || teamName.trim().length === 0}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Team'}
          </Button>
        </form>
      </div>
    </div>
  )
}
