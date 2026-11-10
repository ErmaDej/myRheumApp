import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
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
  Moon,
  NotebookPen,
  Pill,
  Search,
  Settings,
  Sun,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/data/auth'
import { useData } from '@/data/DataProvider'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { supabaseConfigured } from '@/data/remote'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  hint: string
  group: 'Go to' | 'Actions'
  icon: typeof Search
  keywords?: string
  run: () => void
}

export const CommandPalette = ({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) => {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const { state, syncNow, refreshFromRemote } = useData()
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const commands = useMemo<Command[]>(() => {
    const go = (
      id: string,
      label: string,
      hint: string,
      icon: Command['icon'],
      path: string,
      keywords = '',
    ): Command => ({
      id,
      label,
      hint,
      group: 'Go to',
      icon,
      keywords,
      run: () => {
        navigate(path)
        onClose()
      },
    })

    const actions: Command[] = [
      {
        id: 'new-check-in',
        label: 'New daily check-in',
        hint: 'Open the journal with a fresh entry',
        group: 'Actions',
        icon: NotebookPen,
        keywords: 'symptom pain fatigue add journal',
        run: () => {
          navigate('/health-journal?new=1')
          onClose()
        },
      },
      {
        id: 'add-lab',
        label: 'Add laboratory result',
        hint: 'Enter one value with its own unit',
        group: 'Actions',
        icon: FlaskConical,
        keywords: 'lab crp esr blood test result',
        run: () => {
          navigate('/laboratory?new=1')
          onClose()
        },
      },
      {
        id: 'import-report',
        label: 'Import a laboratory report',
        hint: 'Group several results and attach the original PDF',
        group: 'Actions',
        icon: FileText,
        keywords: 'pdf attach panel report import preliminary',
        run: () => {
          navigate('/laboratory?import=1')
          onClose()
        },
      },
      {
        id: 'add-medication',
        label: 'Add a medication plan',
        hint: 'Record a prescribed dose schedule',
        group: 'Actions',
        icon: Pill,
        keywords: 'medicine dose prescription',
        run: () => {
          navigate('/medications?new=1')
          onClose()
        },
      },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        hint: 'Toggle appearance',
        group: 'Actions',
        icon: theme === 'dark' ? Sun : Moon,
        keywords: 'dark light appearance colour',
        run: () => {
          toggleTheme()
          onClose()
        },
      },
    ]

    if (supabaseConfigured && user?.mode === 'remote') {
      actions.push(
        {
          id: 'sync',
          label: 'Sync now',
          hint: `${state.outbox.length} queued change${state.outbox.length === 1 ? '' : 's'}`,
          group: 'Actions',
          icon: CloudUpload,
          keywords: 'upload queue network',
          run: () => {
            void syncNow()
            void refreshFromRemote()
            toast({ title: 'Sync requested', variant: 'info' })
            onClose()
          },
        },
        {
          id: 'sign-out',
          label: 'Sign out',
          hint: 'End this session on this device',
          group: 'Actions',
          icon: LogOut,
          keywords: 'logout leave',
          run: () => {
            void signOut()
            navigate('/login', { replace: true })
            onClose()
          },
        },
      )
    }

    return [
      go('dashboard', 'Dashboard', 'Today, medications, trends', LayoutDashboard, '/dashboard', 'home today'),
      go('journal', 'Daily journal', 'Check-in and symptom history', NotebookPen, '/health-journal', 'symptoms checkin'),
      go('scores', 'Scores', 'BASDAI, BASFI, ASDAS', Gauge, '/measurements', 'questionnaire index'),
      go('meds', 'Medications', 'Plans, doses, adherence', Pill, '/medications', 'dose adherence'),
      go('appointments', 'Appointments', 'Visits, questions, tasks', CalendarDays, '/appointments', 'visit clinic'),
      go('progress', 'Progress', 'Baseline versus recent', TrendingUp, '/progress', 'trend comparison'),
      go('labs', 'Laboratory', 'Results, trends, reports', FlaskConical, '/laboratory', 'blood crp esr'),
      go('records', 'Medical records', 'Documents and attachments', FolderOpen, '/medical-records', 'documents files'),
      go('photos', 'Photo journal', 'Private on-device photographs', Images, '/photo-journal', 'images skin'),
      go('reports', 'Reports & exports', 'Summary, CSV, PDF, backup', FileText, '/reports', 'export pdf csv backup'),
      go('anatomy', 'Anatomy explorer', '3D educational model', Bone, '/anatomy', '3d body joints'),
      go('settings', 'Settings', 'Profile, reminders, privacy', Settings, '/settings', 'preferences account'),
      ...actions,
    ]
  }, [navigate, onClose, theme, toggleTheme, signOut, user, state.outbox.length, syncNow, refreshFromRemote, toast])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.keywords ?? ''}`.toLowerCase().includes(needle),
    )
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = setTimeout(() => inputRef.current?.focus(), 20)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open || typeof document === 'undefined') return null

  const choose = (command: Command | undefined) => {
    if (!command) return
    command.run()
  }

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-start justify-center px-3 pt-[12vh]">
      <div
        className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-navy-900/10 bg-surface shadow-2xl animate-fade-rise dark:border-white/10"
      >
        <div className="flex items-center gap-2 border-b border-navy-900/10 px-3.5 dark:border-white/10">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => (filtered.length ? (index + 1) % filtered.length : 0))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) =>
                  filtered.length ? (index - 1 + filtered.length) % filtered.length : 0,
                )
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(filtered[active])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filtered[active] ? `command-${filtered[active].id}` : undefined}
            placeholder="Search sections, actions, records…"
            className="h-12 w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-md border border-navy-900/15 px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:block dark:border-white/15">
            Esc
          </kbd>
        </div>

        <ul id="command-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted">No matching command.</li>
          ) : (
            filtered.map((command, index) => {
              const showGroup = index === 0 || filtered[index - 1].group !== command.group
              return (
                <li key={command.id}>
                  {showGroup ? (
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                      {command.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`command-${command.id}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(command)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                      index === active
                        ? 'bg-navy-900 text-white dark:bg-teal-400 dark:text-navy-950'
                        : 'text-ink hover:bg-navy-900/5 dark:hover:bg-white/10',
                    )}
                  >
                    <command.icon
                      className={cn('size-4 shrink-0', index === active ? 'opacity-100' : 'text-muted')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{command.label}</span>
                      <span
                        className={cn(
                          'block truncate text-[11px]',
                          index === active ? 'text-white/70 dark:text-navy-900/70' : 'text-muted',
                        )}
                      >
                        {command.hint}
                      </span>
                    </span>
                    <ArrowRight
                      className={cn('size-3.5 shrink-0', index === active ? 'opacity-80' : 'opacity-0')}
                      aria-hidden
                    />
                  </button>
                </li>
              )
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-navy-900/10 px-3.5 py-2 text-[10px] text-muted dark:border-white/10">
          <span>↑↓ to move · Enter to open</span>
          <span className="hidden sm:inline">Ctrl / ⌘ + K</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
