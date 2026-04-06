import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  due_date: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface AddTaskDialogProps {
  onAdd: (title: string, dueDate?: string) => void
  isPending?: boolean
}

export function AddTaskDialog({ onAdd, isPending = false }: AddTaskDialogProps) {
  const [open, setOpen] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', due_date: '' },
  })

  function onSubmit(values: FormValues) {
    const dueDate =
      values.due_date && values.due_date.trim() !== ''
        ? new Date(values.due_date).toISOString()
        : undefined
    onAdd(values.title, dueDate)
    reset()
    setOpen(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset()
    setOpen(nextOpen)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {/* FAB — floating action button */}
      <Dialog.Trigger
        aria-label="Add task"
        className={cn(
          'fixed bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] right-4',
          'h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center text-2xl font-light',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          'transition-transform active:scale-95',
          'min-h-[44px] min-w-[44px]',
        )}
      >
        +
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup
          className={cn(
            'fixed inset-x-4 bottom-4 z-50',
            'bg-background rounded-xl shadow-xl p-5 space-y-4',
            'focus-visible:outline-none',
          )}
        >
          <Dialog.Title className="text-base font-semibold">
            New task
          </Dialog.Title>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="What needs doing?"
                autoFocus
                {...register('title')}
                aria-invalid={errors.title ? true : undefined}
              />
              {errors.title && (
                <p className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due-date">Due date (optional)</Label>
              <Input
                id="task-due-date"
                type="date"
                {...register('due_date')}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Dialog.Close
                render={<Button type="button" variant="outline" className="flex-1" />}
              >
                Cancel
              </Dialog.Close>
              <Button
                type="submit"
                className="flex-1"
                disabled={isPending}
              >
                {isPending ? 'Adding…' : 'Add task'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
