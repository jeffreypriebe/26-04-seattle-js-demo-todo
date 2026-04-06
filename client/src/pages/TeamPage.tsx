import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

// Temporary: hardcoded team ID until team selection is implemented
const TEAM_ID = 1

export function TeamPage() {
  const queryClient = useQueryClient()
  const [copied, setCopied] = React.useState<'code' | 'link' | null>(null)
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const addInputRef = React.useRef<HTMLInputElement>(null)

  const { data: inviteData, isLoading: inviteLoading, isError: inviteError } = useQuery({
    queryKey: ['team-invite', TEAM_ID],
    queryFn: () => fetchTeamInvite(TEAM_ID),
    retry: false,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['team-tasks', TEAM_ID],
    queryFn: () => fetchTeamTasks(TEAM_ID),
    retry: false,
  })

  const addTaskMutation = useMutation({
    mutationFn: (title: string) => createTeamTask(TEAM_ID, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-tasks', TEAM_ID] })
      setNewTaskTitle('')
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
              className="rounded-lg border border-border bg-card p-3"
            >
              <p className="text-sm leading-snug">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {task.creator_name}
              </p>
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
