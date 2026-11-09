import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------- Button -------------------------------- */

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export const buttonStyles = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
    'focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' && 'min-h-9 px-3 text-xs',
    size === 'md' && 'min-h-11 px-4 text-sm',
    size === 'lg' && 'min-h-12 px-5 text-base',
    variant === 'primary' &&
      'bg-navy-900 text-white hover:bg-navy-800 dark:bg-teal-400 dark:text-navy-950 dark:hover:bg-teal-300',
    // Mint fill with dark ink: 10:1 contrast. Overriding a primary button's text colour
    // through className was unreliable because both utilities reached the stylesheet.
    variant === 'accent' && 'bg-teal-400 text-navy-950 hover:bg-teal-300 dark:hover:bg-teal-300',
    variant === 'secondary' &&
      'border border-navy-900/15 bg-white text-ink hover:bg-navy-900/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10',
    variant === 'ghost' && 'text-muted hover:bg-navy-900/5 hover:text-ink dark:hover:bg-white/10',
    variant === 'danger' && 'bg-danger-600 text-white hover:bg-danger-500',
  )

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = ({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) => (
  <button type={type} className={cn(buttonStyles(variant, size), className)} {...props} />
)

export const IconButton = ({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      'inline-flex size-10 items-center justify-center rounded-xl text-muted transition-colors',
      'hover:bg-navy-900/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
      'dark:hover:bg-white/10',
      className,
    )}
    {...props}
  />
)

/* --------------------------------- Card --------------------------------- */

export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn('card-surface rounded-2xl', className)}>{children}</div>
)

export const CardHeader = ({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) => (
  <div className={cn('flex items-start justify-between gap-3', className)}>
    <div className="min-w-0">
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p> : null}
    </div>
    {action}
  </div>
)

/* -------------------------------- Badge --------------------------------- */

export type BadgeTone = 'neutral' | 'teal' | 'lavender' | 'amber' | 'danger'

export const Badge = ({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
      tone === 'neutral' && 'bg-navy-900/8 text-muted dark:bg-white/10',
      tone === 'teal' && 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200',
      tone === 'lavender' && 'bg-lavender-100 text-navy-800 dark:bg-lavender-400/15 dark:text-lavender-200',
      tone === 'amber' && 'bg-amber-400/20 text-amber-600 dark:text-amber-400',
      tone === 'danger' && 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
      className,
    )}
  >
    {children}
  </span>
)

/* --------------------------------- Field -------------------------------- */

export const Field = ({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  optional,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
  className?: string
  optional?: boolean
}) => (
  <div className={cn('space-y-1.5', className)}>
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 text-xs font-normal text-muted">(optional)</span> : null}
      </label>
    </div>
    {children}
    {error ? (
      <p className="text-xs font-medium text-danger-600 dark:text-danger-400" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-xs leading-relaxed text-muted">{hint}</p>
    ) : null}
  </div>
)

const controlClasses =
  'w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 ' +
  'transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ' +
  'dark:border-white/15 dark:bg-navy-900/50 dark:placeholder:text-muted/60'

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn(controlClasses, className)} {...props} />
)

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn(controlClasses, 'min-h-24 resize-y', className)} {...props} />
)

export const Select = ({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn(controlClasses, 'pr-8', className)} {...props}>
    {children}
  </select>
)

/* ----------------------------- Range slider ----------------------------- */

export const RangeSlider = ({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  lowLabel,
  highLabel,
  id,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  lowLabel?: string
  highLabel?: string
  id?: string
}) => {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="rounded-lg bg-teal-100 px-2 py-0.5 text-sm font-bold tabular-nums text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
          {value}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value} out of ${max}`}
        className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-navy-900/10 dark:bg-white/15"
        style={{
          background: `linear-gradient(to right, var(--color-teal-500) ${percent}%, transparent ${percent}%)`,
          height: 8,
        }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{lowLabel ?? `${min} — none`}</span>
        <span>{highLabel ?? `${max} — worst`}</span>
      </div>
    </div>
  )
}

/* -------------------------------- Switch -------------------------------- */

export const Switch = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink">{label}</p>
      {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p> : null}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
        checked ? 'bg-teal-500' : 'bg-navy-900/20 dark:bg-white/20',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  </div>
)

/* ------------------------------ Empty state ----------------------------- */

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-900/15 px-6 py-10 text-center dark:border-white/15">
    {icon ? (
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
        {icon}
      </div>
    ) : null}
    <p className="text-sm font-semibold text-ink">{title}</p>
    <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)

/* --------------------------------- Stat --------------------------------- */

export const Stat = ({
  label,
  value,
  unit,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: string
  tone?: 'default' | 'teal' | 'amber'
}) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
    <p
      className={cn(
        'mt-1 flex items-baseline gap-1 text-2xl font-bold tabular-nums tracking-tight',
        tone === 'default' && 'text-ink',
        tone === 'teal' && 'text-teal-700 dark:text-teal-300',
        tone === 'amber' && 'text-amber-600 dark:text-amber-400',
      )}
    >
      {value}
      {unit ? <span className="text-xs font-medium text-muted">{unit}</span> : null}
    </p>
    {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
  </div>
)

/* ----------------------------- SectionHeader ---------------------------- */

export const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {description ? <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{description}</p> : null}
    </div>
    {action}
  </div>
)

/* -------------------------------- Skeleton ------------------------------ */

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('skeleton rounded-xl', className)} aria-hidden />
)

/* --------------------------------- Modal -------------------------------- */

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const focusTarget = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusTarget?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className={cn(
          'relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl animate-fade-rise sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p id="modal-description" className="mt-1 text-xs leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="size-5" aria-hidden />
          </IconButton>
        </div>
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/* --------------------------- SegmentedControl --------------------------- */

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  label: string
}) => (
  <div
    role="group"
    aria-label={label}
    className="inline-flex rounded-xl bg-navy-900/5 p-1 dark:bg-white/10"
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
          value === option.value
            ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white'
            : 'text-muted hover:text-ink',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/* ------------------------------ InlineAlert ----------------------------- */

export const InlineAlert = ({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger'
  title?: string
  children: ReactNode
}) => (
  <div
    role={tone === 'danger' ? 'alert' : 'note'}
    className={cn(
      'rounded-xl border p-3 text-xs leading-relaxed',
      tone === 'info' && 'border-lavender-300/60 bg-lavender-50 text-navy-800 dark:bg-lavender-400/10 dark:text-lavender-100',
      tone === 'warning' && 'border-amber-500/40 bg-amber-400/10 text-amber-700 dark:text-amber-200',
      tone === 'danger' && 'border-danger-500/40 bg-danger-500/10 text-danger-600 dark:text-danger-300',
    )}
  >
    {title ? <p className="mb-1 font-semibold">{title}</p> : null}
    {children}
  </div>
)
