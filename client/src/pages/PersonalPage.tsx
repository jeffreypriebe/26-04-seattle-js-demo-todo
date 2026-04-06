import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { AddTaskDialog } from '@/components/AddTaskDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Task {
  id: number
  title: string
  due_date: string | null
  completed: boolean
  position: number
  created_at: string
  updated_at: string
}

async function fetchTasks(): Promise<Task[]> {
  const res = await apiFetch('/tasks')
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json() as Promise<Task[]>
}

async function createTask(body: {
  title: string
  due_date?: string
}): Promise<Task> {
  const res = await apiFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create task')
  return res.json() as Promise<Task>
}

async function deleteTask(id: number): Promise<void> {
  const res = await apiFetch(`/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete task')
}

async function toggleTask(vars: {
  id: number
  completed: boolean
}): Promise<Task> {
  const res = await apiFetch(`/tasks/${vars.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: vars.completed }),
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json() as Promise<Task>
}

export function PersonalPage() {
  const queryClient = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  })

  const addMutation = useMutation({
    mutationFn: createTask,
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])

      // Optimistic: append a temporary task at end of list
      const optimistic: Task = {
        id: -Date.now(),
        title: newTask.title,
        due_date: newTask.due_date ?? null,
        completed: false,
        position: Math.max(-1, ...(previous ?? []).map(t => t.position)) + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) => [
        ...old,
        optimistic,
      ])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      // Roll back on failure
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(['tasks'], ctx.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) =>
        old.filter((t) => t.id !== id),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(['tasks'], ctx.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: toggleTask,
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) =>
        old.map(t => (t.id === id ? { ...t, completed } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(['tasks'], ctx.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  function handleAdd(title: string, dueDate?: string) {
    addMutation.mutate({ title, due_date: dueDate })
  }

  return (
    <div className="p-4 pb-8">
      <h1 className="text-xl font-semibold mb-4">Personal</h1>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading tasks…</p>
      )}

      {!isLoading && tasks.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No tasks yet. Tap + to add one.
        </p>
      )}

      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={task.completed}
              aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
              onClick={() =>
                toggleMutation.mutate({ id: task.id, completed: !task.completed })
              }
              className={cn(
                'shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                'min-h-[44px] min-w-[44px]',
                task.completed
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground bg-transparent',
              )}
            >
              {task.completed && (
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  className="h-3 w-3"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span
              className={cn(
                'flex-1 text-sm leading-snug',
                task.completed && 'line-through text-muted-foreground',
              )}
            >
              {task.title}
            </span>
            {task.due_date && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Delete task: ${task.title}`}
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(task.id)}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>

      <AddTaskDialog
        onAdd={handleAdd}
        isPending={addMutation.isPending}
      />
    </div>
  )
}
