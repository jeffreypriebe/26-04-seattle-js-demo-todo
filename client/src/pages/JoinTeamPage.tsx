import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Team {
  id: number
  name: string
  invite_code: string
  created_at: string
  updated_at: string
}

async function joinTeam(code: string): Promise<Team> {
  const res = await apiFetch('/teams/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (res.status === 404) throw new Error('Invalid invite code')
  if (res.status === 409) throw new Error('You are already a member of a team')
  if (!res.ok) throw new Error('Failed to join team')
  return res.json() as Promise<Team>
}

export function JoinTeamPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [code, setCode] = React.useState(searchParams.get('code') ?? '')

  const joinMutation = useMutation({
    mutationFn: joinTeam,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-me'] })
      void navigate('/team')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    joinMutation.mutate(trimmed)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2">Join a team</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter the invite code shared by your team.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Invite code"
            value={code}
            onChange={e => setCode(e.target.value)}
            disabled={joinMutation.isPending}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
          />

          {joinMutation.isError && (
            <p className="text-sm text-destructive">
              {joinMutation.error instanceof Error
                ? joinMutation.error.message
                : 'Something went wrong'}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={joinMutation.isPending || code.trim() === ''}
          >
            {joinMutation.isPending ? 'Joining…' : 'Join team'}
          </Button>
        </form>
      </div>
    </div>
  )
}
