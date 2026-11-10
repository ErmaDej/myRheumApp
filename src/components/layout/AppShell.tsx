import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bone,
  CalendarDays,
  CloudUpload,
  FileText,
  FlaskConical,
  FolderOpen,
  Gauge,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Pill,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/data/auth'
import { useData } from '@/data/DataProvider'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { Badge, Button, IconButton, Modal } from '@/components/ui'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { cn, formatRelative } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const primaryNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/health-journal', label: 'Journal', icon: NotebookPen },
  { to: '/measurements', label: 'Scores', icon: Gauge },
  { to: '/medications', label: 'Medications', icon: Pill },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
]

const secondaryNav: NavItem[] = [
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/laboratory', label: 'Laboratory', icon: FlaskConical },
  { to: '/medical-records', label: 'Medical records', icon: FolderOpen },
  { to: '/photo-journal', label: 'Photo journal', icon: Images },
  { to: '/reports', label: 'Reports & exports', icon: FileText },
  { to: '/anatomy', label: 'Anatomy explorer', icon: Bone },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const titleForPath = (pathname: string): string => {
  const all = [...primaryNav, ...secondaryNav]
  if (pathname === '/onboarding') return 'Welcome'
  const match = all.find((item) => pathname.startsWith(item.to))
  return match?.label ?? 'myRheumApp'
}

const SyncChip = () => {
  const { state, syncNow } = useData()
  const { toast } = useToast()
  const pending = state.outbox.length

  if (!state.online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
        <WifiOff className="size-3.5" aria-hidden /> Offline
      </span>
    )
  }

  if (pending > 0) {
    return (
      <button
        type="button"
        onClick={() => {
          void syncNow()
          toast({
            title: 'Sync requested',
            description: 'Queued changes will upload when your account connection is available.',
            variant: 'info',
          })
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-lavender-100 px-2.5 py-1 text-[11px] font-semibold text-navy-800 transition hover:bg-lavender-200 dark:bg-lavender-400/15 dark:text-lavender-100"
      >
        <CloudUpload className="size-3.5" aria-hidden /> {pending} queued
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
      <span className="size-1.5 rounded-full bg-teal-500" aria-hidden />
      {state.data.lastSyncedAt ? `Synced ${formatRelative(state.data.lastSyncedAt)}` : 'Local only'}
    </span>
  )
}

const NavLinks = ({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) => (
  <ul className="space-y-0.5">
    {items.map((item) => (
      <li key={item.to}>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              isActive
                ? 'bg-navy-900 text-white shadow-sm dark:bg-teal-400 dark:text-navy-950'
                : 'text-muted hover:bg-navy-900/5 hover:text-ink dark:hover:bg-white/10',
            )
          }
        >
          <item.icon className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">{item.label}</span>
        </NavLink>
      </li>
    ))}
  </ul>
)

const Brand = () => (
  <div className="flex items-center gap-2.5">
    <img src="/icons/icon-192.png" alt="" className="size-9 rounded-xl" width={36} height={36} />
    <div className="leading-tight">
      <p className="text-sm font-bold tracking-tight text-ink">myRheumApp</p>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted">Rheum journal</p>
    </div>
  </div>
)

export const AppShell = () => {
  const { user, signOut } = useAuth()
  const { state } = useData()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Ctrl/⌘+K opens the palette from anywhere; "/" does too when not typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      } else if (event.key === '/' && !typing) {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const title = useMemo(() => titleForPath(location.pathname), [location.pathname])
  const isDemo = user?.mode === 'demo'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-navy-900/10 bg-card px-4 py-5 no-print lg:flex dark:border-white/10">
        <div className="px-1">
          <Brand />
        </div>
        <nav className="mt-7 flex-1 space-y-6 overflow-y-auto pb-4" aria-label="Primary">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted">Today</p>
            <NavLinks items={primaryNav} />
          </div>
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted">Review</p>
            <NavLinks items={secondaryNav} />
          </div>
        </nav>

        <div className="space-y-3 border-t border-navy-900/10 pt-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <SyncChip />
            <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
            </IconButton>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-navy-900/5 p-2 dark:bg-white/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-white dark:bg-teal-400 dark:text-navy-950">
              {state.data.profile.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{state.data.profile.name}</p>
              <p className="truncate text-[10px] text-muted">{user?.email}</p>
            </div>
            <IconButton label="Sign out" onClick={() => void handleSignOut()}>
              <LogOut className="size-4" aria-hidden />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-surface/85 backdrop-blur-md no-print dark:border-white/10">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="rounded-xl p-2 text-muted hover:bg-navy-900/5 hover:text-ink lg:hidden dark:hover:bg-white/10"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" aria-hidden />
              </button>
              <h1 className="text-base font-semibold tracking-tight text-ink">{title}</h1>
              {isDemo ? (
                <Badge tone="lavender" className="hidden sm:inline-flex">
                  <Sparkles className="size-3" aria-hidden /> Demo
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-xl border border-navy-900/10 bg-card px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-ink sm:inline-flex dark:border-white/10 dark:hover:bg-white/10"
                aria-label="Search and quick actions"
              >
                <Search className="size-3.5" aria-hidden />
                <span className="hidden md:inline">Search</span>
                <kbd className="rounded border border-navy-900/15 px-1 text-[10px] font-semibold dark:border-white/15">
                  ⌘K
                </kbd>
              </button>
              <IconButton label="Search and quick actions" onClick={() => setPaletteOpen(true)} className="sm:hidden">
                <Search className="size-4.5" aria-hidden />
              </IconButton>
              <SyncChip />
              <IconButton
                label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={toggleTheme}
                className="lg:hidden"
              >
                {theme === 'dark' ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
              </IconButton>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="hidden size-10 items-center justify-center rounded-xl text-muted hover:bg-navy-900/5 hover:text-ink sm:inline-flex lg:hidden dark:hover:bg-white/10"
                aria-label="Sign out"
              >
                <LogOut className="size-4.5" aria-hidden />
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
          {isDemo ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-lavender-300/60 bg-lavender-50 px-3.5 py-2.5 text-xs leading-relaxed text-navy-800 dark:bg-lavender-400/10 dark:text-lavender-100 no-print">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lavender-400" aria-hidden />
              <p>
                <strong className="font-semibold">Preview mode.</strong> Every clinical value on this screen is
                synthetic demo data. Nothing here is medical advice, and no real patient record is used.
              </p>
            </div>
          ) : null}

          <div key={location.pathname} className="animate-fade-rise">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-900/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md no-print lg:hidden dark:border-white/10"
          aria-label="Primary"
        >
          <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
            {primaryNav.map((item) => (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors',
                      isActive ? 'text-teal-700 dark:text-teal-300' : 'text-muted',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-xl transition-colors',
                          isActive && 'bg-teal-100 dark:bg-teal-500/20',
                        )}
                      >
                        <item.icon className="size-4.5" aria-hidden />
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold text-muted"
              >
                <span className="flex size-8 items-center justify-center rounded-xl">
                  <Menu className="size-4.5" aria-hidden />
                </span>
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="All sections" description="Jump to any part of your journal.">
        <div className="grid grid-cols-2 gap-2">
          {[...primaryNav, ...secondaryNav].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200'
                    : 'border-navy-900/10 text-ink hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10',
                )
              }
            >
              <item.icon className="size-4.5 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-navy-900/5 p-3 dark:bg-white/5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{user?.email}</p>
            <p className="text-[10px] text-muted">{user?.mode === 'demo' ? 'Local demo session' : 'Supabase account'}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void handleSignOut()}>
            <LogOut className="size-3.5" aria-hidden /> Sign out
          </Button>
        </div>
      </Modal>

      {/* Hidden status for assistive technology */}
      <div className="sr-only" role="status" aria-live="polite">
        {state.online ? 'You are online.' : 'You are offline. Entries are saved on this device.'}
      </div>
    </div>
  )
}
