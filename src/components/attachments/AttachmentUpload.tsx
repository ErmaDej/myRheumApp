import { useRef, useState } from 'react'
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import type { Attachment, AttachmentKind } from '@/data/types'
import {
  createAttachmentUrl,
  supabaseConfigured,
  uploadAttachmentFile,
} from '@/data/remote'
import { Badge, InlineAlert } from '@/components/ui'
import { cn, formatDate, uid } from '@/lib/utils'

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const sha256Hex = async (file: File): Promise<string | undefined> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return undefined
  }
}

const kindLabel: Record<AttachmentKind, string> = {
  'lab-report': 'Lab report',
  imaging: 'Imaging',
  prescription: 'Prescription',
  referral: 'Referral',
  photo: 'Photograph',
  other: 'Document',
}

/**
 * Upload one file to the private bucket and record its metadata.
 *
 * The bytes never touch the public web: the bucket is private and the UI opens
 * short-lived signed URLs. Without a configured Supabase project the control is
 * disabled rather than silently storing a file in the browser only.
 */
export const AttachmentField = ({
  patientId,
  kind,
  documentId,
  labPanelId,
  importBatchId,
  onUploaded,
  disabled,
}: {
  patientId: string
  kind: AttachmentKind
  documentId?: string
  labPanelId?: string
  importBatchId?: string
  onUploaded?: (attachment: Attachment) => void
  disabled?: boolean
}) => {
  const { store } = useData()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)
    if (!ALLOWED.includes(file.type)) {
      setError('Only PDF, JPEG, PNG or WebP files can be attached.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That file is larger than the 25 MB limit.')
      return
    }

    setBusy(true)
    try {
      const storagePath = await uploadAttachmentFile(patientId, file)
      const attachment: Attachment = {
        id: uid('att'),
        patientId,
        documentId,
        labPanelId,
        importBatchId,
        storageBucket: 'medical-documents',
        storagePath,
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        sha256: await sha256Hex(file),
        kind,
        capturedOn: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      }
      store.saveAttachment(attachment)
      onUploaded?.(attachment)
      toast({
        title: 'File attached',
        description: 'Stored in your private bucket and linked to this record.',
        variant: 'success',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The upload failed. Try again.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (!supabaseConfigured || disabled) {
    return (
      <InlineAlert tone="info" title="Original files need your private account">
        Connect the Supabase project (URL + publishable key) to upload the original PDF or photograph.
        Metadata-only records still save normally.
      </InlineAlert>
    )
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) void upload(file)
        }}
        className={cn(
          'rounded-xl border border-dashed px-3 py-4 text-center transition',
          dragging
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
            : 'border-navy-900/20 dark:border-white/20',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(',')}
          className="sr-only"
          id={`attachment-${kind}`}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <label
          htmlFor={`attachment-${kind}`}
          className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-300"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {busy ? 'Uploading privately…' : 'Drop a file here or choose one'}
        </label>
        <p className="mt-1 text-[11px] text-muted">PDF, JPEG, PNG or WebP · up to 25 MB · private bucket</p>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Existing files with a short-lived signed download link. */
export const AttachmentList = ({
  attachments,
  emptyHint,
}: {
  attachments: Attachment[]
  emptyHint?: string
}) => {
  const { store } = useData()
  const { toast } = useToast()
  const [opening, setOpening] = useState<string | null>(null)

  if (attachments.length === 0) {
    return emptyHint ? <p className="text-[11px] italic text-muted">{emptyHint}</p> : null
  }

  const open = async (attachment: Attachment) => {
    setOpening(attachment.id)
    try {
      const url = await createAttachmentUrl(attachment)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      toast({
        title: 'Could not open the file',
        description: cause instanceof Error ? cause.message : 'Try again while online.',
        variant: 'error',
      })
    } finally {
      setOpening(null)
    }
  }

  return (
    <ul className="space-y-1.5">
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex items-center gap-2 rounded-xl border border-navy-900/10 px-2.5 py-2 dark:border-white/10"
        >
          <Paperclip className="size-3.5 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{attachment.fileName}</p>
            <p className="text-[10px] text-muted">
              {kindLabel[attachment.kind]} · {formatBytes(attachment.byteSize)}
              {attachment.capturedOn ? ` · ${formatDate(attachment.capturedOn)}` : ''}
            </p>
          </div>
          {attachment.sha256 ? (
            <Badge tone="neutral" className="hidden sm:inline-flex">
              SHA-256
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={() => void open(attachment)}
            className="rounded-lg p-1.5 text-muted transition hover:bg-navy-900/5 hover:text-ink dark:hover:bg-white/10"
            aria-label={`Open ${attachment.fileName}`}
            disabled={opening === attachment.id}
          >
            {opening === attachment.id ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              store.deleteAttachment(attachment.id)
              toast({ title: 'Attachment removed', variant: 'success' })
            }}
            className="rounded-lg p-1.5 text-muted transition hover:bg-danger-500/10 hover:text-danger-600"
            aria-label={`Remove ${attachment.fileName}`}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

export const AttachmentEmptyIcon = FileText
