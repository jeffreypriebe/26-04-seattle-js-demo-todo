import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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

interface InviteData {
  invite_code: string
  invite_link: string
}

interface TeamTask {
  id: number
  title: string
  completed: boolean
  creator_name: string
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
  if (!res.ok) throw new Error('Failed to create team')
  return res.json() as Promise<Team>
}

async function fetchTeamInvite(teamId: number): Promise<InviteData> {
  const res = await apiFetch(`/teams/${teamId}/invite`)
  if (!res.ok) throw new Error('Failed to fetch invite')
  return res.json() as Promise<InviteData>
}

async function fetchTeamTasks(teamId: number): Promise<TeamTask[]> {
  const res = await apiFetch(`/teams/${teamId}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch team tasks')
  return res.json() as Promise<TeamTask[]>
}

async function createTeamTask(teamId: number, title: string): Promise<TeamTask> {
  const res = await apiFetch(`/teams/${teamId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Failed to create team task')
  return res.json() as Promise<TeamTask>
}

async function toggleTeamTask(teamId: number, taskId: number): Promise<TeamTask> {
  const res = await apiFetch(`/teams/${teamId}/tasks/${taskId}`, {
    method: 'PATCH',
  })
  if (!res.ok) throw new Error('Failed to toggle team task')
  return res.json() as Promise<TeamTask>
}

async function deleteTeamTask(teamId: number, taskId: number): Promise<void> {
  const res = await apiFetch(`/teams/${teamId}/tasks/${taskId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete team task')
}

// Temporary: hardcoded team ID until team selection is implemented
const TEAM_ID = 1


export function TeamPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team-me'],
    queryFn: fetchMyTeam,
    retry: false,
  })

  if (teamLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!team) {
    return <NoTeamView onTeamCreated={(t) => {
      queryClient.setQueryData(['team-me'], t)
    }} onJoinTeam={() => void navigate('/join')} />
  }

  return <TeamView team={team} queryClient={queryClient} />
}

function NoTeamView({
  onTeamCreated,
  onJoinTeam,
}: {
  onTeamCreated: (team: Team) => void
  onJoinTeam: () => void
}) {
  const [teamName, setTeamName] = React.useState('')
  const [showCreate, setShowCreate] = React.useState(false)

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: onTeamCreated,
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = teamName.trim()
    if (!name) return
    createMutation.mutate(name)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-6">Team</h1>
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <p className="text-sm font-medium">You're not on a team yet</p>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Join an existing team with an invite code, or create a new one.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onJoinTeam}>
            Join team
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            Create team
          </Button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="flex gap-2 mt-2 w-full max-w-xs">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              disabled={createMutation.isPending}
              autoFocus
            />
            <Button
              type="submit"
              disabled={createMutation.isPending || teamName.trim() === ''}
            >
              Create
            </Button>
          </form>
        )}

        {createMutation.isError && (
          <p className="text-sm text-destructive">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Something went wrong'}
          </p>
        )}
      </div>
    </div>
  )
}

function TeamView({
  team,
  queryClient,
}: {
  team: Team
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const [copied, setCopied] = React.useState<'code' | 'link' | null>(null)
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const addInputRef = React.useRef<HTMLInputElement>(null)

  const { data: inviteData, isLoading: inviteLoading, isError: inviteError } = useQuery({
    queryKey: ['team-invite', team.id],
    queryFn: () => fetchTeamInvite(team.id),
    retry: false,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['team-tasks', team.id],
    queryFn: () => fetchTeamTasks(team.id),
    retry: false,
  })

  const addTaskMutation = useMutation({
    mutationFn: (title: string) => createTeamTask(team.id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-tasks', team.id] })
      setNewTaskTitle('')
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: number) => toggleTeamTask(TEAM_ID, taskId),
    onMutate: async (taskId: number) => {
      await queryClient.cancelQueries({ queryKey: ['team-tasks', TEAM_ID] })
      const previous = queryClient.getQueryData<TeamTask[]>(['team-tasks', TEAM_ID])
      queryClient.setQueryData<TeamTask[]>(['team-tasks', TEAM_ID], old =>
        old?.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) ?? []
      )
      return { previous }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['team-tasks', TEAM_ID], context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-tasks', TEAM_ID] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => deleteTeamTask(TEAM_ID, taskId),
    onMutate: async (taskId: number) => {
      await queryClient.cancelQueries({ queryKey: ['team-tasks', TEAM_ID] })
      const previous = queryClient.getQueryData<TeamTask[]>(['team-tasks', TEAM_ID])
      queryClient.setQueryData<TeamTask[]>(['team-tasks', TEAM_ID], old =>
        old?.filter(t => t.id !== taskId) ?? []
      )
      return { previous }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['team-tasks', TEAM_ID], context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-tasks', TEAM_ID] })
    },
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

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) return
    addTaskMutation.mutate(title)
  }

  function focusAddInput() {
    addInputRef.current?.focus()
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-6">Team</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Team tasks
        </h2>

        <form onSubmit={handleAddTask} className="flex gap-2 mb-3">
          <Input
            ref={addInputRef}
            placeholder="Add a task…"
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            disabled={addTaskMutation.isPending}
          />
          <Button
            type="submit"
            disabled={addTaskMutation.isPending || newTaskTitle.trim() === ''}
          >
            Add
          </Button>
        </form>

        {tasksLoading && (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        )}

        {!tasksLoading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="h-12 w-12 text-muted-foreground/40"
              aria-hidden="true"
            >
              <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
              <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M6 22h36" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="32" cy="34" r="6" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
              <path d="M30 34h4M32 32v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium text-foreground">No shared tasks yet</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Add the first task above — your whole team will see it here.
            </p>
            <button
              type="button"
              onClick={focusAddInput}
              className="mt-1 rounded-md border border-border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Add first task
            </button>
          </div>
        )}

        <ul className="space-y-2">
          {tasks.map(task => (
            <li
              key={task.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <button
                type="button"
                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                onClick={() => toggleTaskMutation.mutate(task.id)}
                className="mt-0.5 shrink-0 h-4 w-4 rounded border border-border flex items-center justify-center transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {task.completed && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-primary" aria-hidden="true">
                    <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug${task.completed ? ' line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {task.creator_name}
                </p>
              </div>
              <button
                type="button"
                aria-label="Delete task"
                onClick={() => deleteTaskMutation.mutate(task.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Invite to team
        </h2>

        {inviteLoading && (
          <p className="text-sm text-muted-foreground">Loading invite…</p>
        )}

        {inviteError && (
          <p className="text-sm text-destructive">
            Could not load invite details.
          </p>
        )}

        {inviteData && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            {/* Invite code row */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Invite code
                </p>
                <p className="font-mono text-sm font-medium tracking-wide truncate">
                  {inviteData.invite_code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(inviteData.invite_code, 'code')}
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
                  {inviteData.invite_link}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(inviteData.invite_link, 'link')}
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
