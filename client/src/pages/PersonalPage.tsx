import * as React from 'react'
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

async function updateTaskPosition(vars: {
  id: number
  position: number
}): Promise<Task> {
  const res = await apiFetch(`/tasks/${vars.id}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position: vars.position }),
  })
  if (!res.ok) throw new Error('Failed to update task position')
  return res.json() as Promise<Task>
}

export function PersonalPage() {
  const queryClient = useQueryClient()
  const [dueDateOnly, setDueDateOnly] = React.useState(false)
  const [draggedId, setDraggedId] = React.useState<number | null>(null)
  const [dragOverId, setDragOverId] = React.useState<number | null>(null)

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

  const positionMutation = useMutation({
    mutationFn: updateTaskPosition,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  function handleAdd(title: string, dueDate?: string) {
    addMutation.mutate({ title, due_date: dueDate })
  }

  function handleDragStart(id: number) {
    setDraggedId(id)
  }

  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault()
    if (id !== draggedId) {
      setDragOverId(id)
    }
  }

  function handleDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault()
    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const current = queryClient.getQueryData<Task[]>(['tasks']) ?? []
    const fromIndex = current.findIndex(t => t.id === draggedId)
    const toIndex = current.findIndex(t => t.id === targetId)

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    // Reorder the list
    const reordered = [...current]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    // Assign new positions based on index
    const updated = reordered.map((t, i) => ({ ...t, position: i }))

    // Optimistic update
    queryClient.setQueryData<Task[]>(['tasks'], updated)

    setDraggedId(null)
    setDragOverId(null)

    // Persist only the moved task's new position
    positionMutation.mutate({ id: draggedId, position: toIndex })
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverId(null)
  }

  const visibleTasks = dueDateOnly
    ? tasks.filter((t) => t.due_date !== null)
    : tasks

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Personal</h1>
        <button
          type="button"
          role="switch"
          aria-checked={dueDateOnly}
          aria-label="Show only tasks with due dates"
          onClick={() => setDueDateOnly((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            dueDateOnly
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40',
          )}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden="true">
            <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M1 5h10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Due date
        </button>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading tasks…</p>
      )}

      {!isLoading && visibleTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            className="h-12 w-12 text-muted-foreground/40"
            aria-hidden="true"
          >
            <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
            <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M6 22h36" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="24" cy="33" r="5" stroke="currentColor" strokeWidth="2.5" />
            <path d="M24 30v3l2 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {dueDateOnly ? (
            <>
              <p className="text-sm font-medium text-foreground">No tasks with due dates</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Add a due date when creating a task, or turn off the filter to see all tasks.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">No tasks yet</p>
              <p className="text-xs text-muted-foreground">
                Tap + to add your first task.
              </p>
            </>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {visibleTasks.map((task) => (
          <li
            key={task.id}
            draggable
            onDragStart={() => handleDragStart(task.id)}
            onDragOver={(e) => handleDragOver(e, task.id)}
            onDrop={(e) => handleDrop(e, task.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-border bg-card p-3',
              'cursor-grab active:cursor-grabbing transition-opacity',
              task.completed && 'opacity-40',
              draggedId === task.id && 'opacity-20',
              dragOverId === task.id && draggedId !== task.id && 'ring-2 ring-primary/50',
            )}
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
