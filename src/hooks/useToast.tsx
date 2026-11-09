import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn, uid } from '@/lib/utils'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
}

type ShowToast = (input: ToastInput | string, variant?: ToastVariant) => void

interface ToastContextValue {
  toast: ShowToast
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-teal-500/40 bg-white dark:bg-navy-800',
  error: 'border-danger-500/40 bg-white dark:bg-navy-800',
  warning: 'border-amber-500/50 bg-white dark:bg-navy-800',
  info: 'border-lavender-300/60 bg-white dark:bg-navy-800',
}

const VariantIcon = ({ variant }: { variant: ToastVariant }) => {
  if (variant === 'success') return <CheckCircle2 className="size-5 text-teal-600" aria-hidden />
  if (variant === 'error') return <AlertTriangle className="size-5 text-danger-500" aria-hidden />
  if (variant === 'warning') return <AlertTriangle className="size-5 text-amber-500" aria-hidden />
  return <Info className="size-5 text-lavender-400" aria-hidden />
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback<ShowToast>(
    (input, variant = 'info') => {
      const item: ToastItem =
        typeof input === 'string'
          ? { id: uid('toast'), title: input, variant }
          : { id: uid('toast'), variant: input.variant ?? 'info', title: input.title, description: input.description }

      setToasts((prev) => [...prev.slice(-3), item])
      const timer = setTimeout(() => dismiss(item.id), 5000)
      timers.current.set(item.id, timer)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 no-print"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'animate-fade-rise pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border p-3.5 shadow-lg backdrop-blur',
              variantStyles[item.variant],
            )}
          >
            <VariantIcon variant={item.variant} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-lg p-1 text-muted transition hover:bg-navy-900/5 hover:text-ink dark:hover:bg-white/10"
              aria-label="Dismiss notification"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
