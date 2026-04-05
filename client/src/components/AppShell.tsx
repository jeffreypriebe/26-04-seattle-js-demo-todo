import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

/**
 * App shell layout.
 *
 * h-dvh-safe applies `height: 100vh` (fallback) then `height: 100dvh`
 * so the layout uses dynamic viewport height where supported. This keeps
 * the bottom nav visible when the virtual keyboard opens on mobile.
 *
 * Content area is flex-1 overflow-y-auto so it scrolls independently of
 * the fixed bottom nav.
 */
export function AppShell() {
  return (
    <div className="h-dvh-safe flex flex-col w-full overflow-hidden">
      {/* Scrollable content area — padded at bottom to clear the fixed nav */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
