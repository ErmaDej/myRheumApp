import { useMemo, useState } from 'react'
import { FileText, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import { AttachmentField, AttachmentList } from '@/components/attachments/AttachmentUpload'
import { supabaseConfigured, uploadAttachmentFile } from '@/data/remote'
import type { AttachmentKind, DocumentCategory, MedicalDocument, Provenance } from '@/data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  Modal,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui'
import { cn, formatDate, todayInputValue, uid } from '@/lib/utils'

const CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'note', label: 'Clinical note' },
  { value: 'imaging', label: 'Imaging report' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'lab-report', label: 'Laboratory report' },
  { value: 'referral', label: 'Referral letter' },
  { value: 'other', label: 'Other' },
]

const categoryLabel = (category: DocumentCategory) =>
  CATEGORIES.find((item) => item.value === category)?.label ?? category

interface DocForm {
  title: string
  category: DocumentCategory
  occurredOn: string
  clinician: string
  body: string
  source: Provenance
}

const attachmentKindFor = (category: DocumentCategory): AttachmentKind => {
  if (category === 'lab-report') return 'lab-report'
  if (category === 'imaging') return 'imaging'
  if (category === 'prescription') return 'prescription'
  if (category === 'referral') return 'referral'
  return 'other'
}

const emptyForm = (): DocForm => ({
  title: '',
  category: 'note',
  occurredOn: todayInputValue(),
  clinician: '',
  body: '',
  source: 'patient',
})

export const MedicalRecords = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<DocForm>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<DocumentCategory | 'all'>('all')
  const [deleteTarget, setDeleteTarget] = useState<MedicalDocument | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const documents = useMemo(
    () =>
      [...data.documents]
        .filter((document) => filter === 'all' || document.category === filter)
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    [data.documents, filter],
  )

  const update = <K extends keyof DocForm>(key: K, value: DocForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return setError('Give the record a clear title.')
    if (!form.occurredOn) return setError('Choose the date on the document.')

    const document: MedicalDocument = {
      id: uid('doc'),
      patientId: data.profile.id,
      title: form.title.trim(),
      category: form.category,
      occurredOn: new Date(`${form.occurredOn}T12:00:00`).toISOString(),
      clinician: form.clinician.trim() || undefined,
      body: form.body.trim() || undefined,
      source: form.source,
      createdAt: new Date().toISOString(),
    }

    store.saveDocument(document)

    if (file && supabaseConfigured) {
      try {
        const storagePath = await uploadAttachmentFile(data.profile.id, file)
        store.saveAttachment({
          id: uid('att'),
          patientId: data.profile.id,
          documentId: document.id,
          storageBucket: 'medical-documents',
          storagePath,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          byteSize: file.size,
          kind: attachmentKindFor(document.category),
          capturedOn: form.occurredOn,
          createdAt: new Date().toISOString(),
        })
      } catch (cause) {
        toast({
          title: 'Record saved, file not uploaded',
          description: cause instanceof Error ? cause.message : 'Attach the file again from the record card.',
          variant: 'warning',
        })
      }
    }

    toast({
      title: 'Record saved',
      description: 'Source is preserved so patient-entered text is never mistaken for a clinician diagnosis.',
      variant: 'success',
    })
    setForm(emptyForm())
    setFile(null)
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Medical records"
        description="Diagnoses, clinical notes, imaging reports, prescriptions and referrals. Keep the original wording and label where each entry came from."
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" aria-hidden /> Add record
          </Button>
        }
      />

      <InlineAlert tone="info" title="Provenance matters">
        A condition you type yourself is a self-reported record, not a verified diagnosis. Only a documented
        clinician assessment should be labelled as clinical.
      </InlineAlert>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
            filter === 'all'
              ? 'border-teal-500 bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
              : 'border-navy-900/15 text-muted dark:border-white/15',
          )}
        >
          All ({data.documents.length})
        </button>
        {CATEGORIES.map((category) => {
          const count = data.documents.filter((document) => document.category === category.value).length
          return (
            <button
              key={category.value}
              type="button"
              aria-pressed={filter === category.value}
              onClick={() => setFilter(category.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                filter === category.value
                  ? 'border-teal-500 bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
                  : 'border-navy-900/15 text-muted dark:border-white/15',
              )}
            >
              {category.label} ({count})
            </button>
          )
        })}
      </div>

      {documents.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<FolderOpen className="size-5" aria-hidden />}
            title="No records in this view"
            description="Add a diagnosis note, imaging report or prescription to build your documented history."
            action={<Button size="sm" onClick={() => setOpen(true)}>Add first record</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {documents.map((document) => (
            <Card key={document.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="lavender">{categoryLabel(document.category)}</Badge>
                    <Badge tone={document.source === 'clinician' ? 'teal' : 'neutral'}>{document.source}</Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-ink">{document.title}</h3>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDate(document.occurredOn)}
                    {document.clinician ? ` · ${document.clinician}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(document)}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger-500/10 hover:text-danger-600"
                  aria-label={`Delete ${document.title}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
              {document.body ? (
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-muted">
                  {document.body}
                </p>
              ) : (
                <p className="mt-2 text-xs italic text-muted">No description recorded.</p>
              )}
              {(() => {
                const files = data.attachments.filter(
                  (attachment) => attachment.documentId === document.id,
                )
                return (
                  <div className="mt-3 space-y-2 border-t border-navy-900/10 pt-2.5 dark:border-white/10">
                    <AttachmentList
                      attachments={files}
                      emptyHint="No original file attached to this record."
                    />
                    <details className="text-[11px]">
                      <summary className="cursor-pointer font-semibold text-teal-700 dark:text-teal-300">
                        Attach a PDF or photograph
                      </summary>
                      <div className="mt-2">
                        <AttachmentField
                          patientId={data.profile.id}
                          kind={attachmentKindFor(document.category)}
                          documentId={document.id}
                        />
                      </div>
                    </details>
                  </div>
                )
              })()}
            </Card>
          ))}
        </div>
      )}

      <Card className="flex items-start gap-3 p-4 text-[11px] leading-relaxed text-muted">
        <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Original PDFs and photographs are stored in the private <strong>medical-documents</strong> bucket under
          your own folder. Links are short-lived signed URLs, never public paths. Transcription stays separate
          from the file so a scan is never mistaken for interpreted data.
        </p>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a medical record"
        description="Transcribe the original document faithfully. Do not paraphrase a diagnosis."
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Title" htmlFor="docTitle">
            <Input
              id="docTitle"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="e.g. MRI sacroiliac joints — report"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category">
              <Select
                id="category"
                value={form.category}
                onChange={(event) => update('category', event.target.value as DocumentCategory)}
              >
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Document date" htmlFor="occurredOn">
              <Input
                id="occurredOn"
                type="date"
                value={form.occurredOn}
                onChange={(event) => update('occurredOn', event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Clinician / author" htmlFor="docClinician" optional>
              <Input
                id="docClinician"
                value={form.clinician}
                onChange={(event) => update('clinician', event.target.value)}
              />
            </Field>
            <Field label="Source" htmlFor="docSource">
              <Select
                id="docSource"
                value={form.source}
                onChange={(event) => update('source', event.target.value as Provenance)}
              >
                <option value="patient">Patient-entered</option>
                <option value="imported">Imported from report</option>
                <option value="clinician">Clinician-entered</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Original file"
            htmlFor="docFile"
            optional
            hint="PDF, JPEG, PNG or WebP up to 25 MB. Stored privately under your account."
          >
            <input
              id="docFile"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-xs text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:border-white/15 dark:bg-navy-900/50 dark:file:bg-teal-400 dark:file:text-navy-950"
            />
          </Field>

          <Field label="Exact wording or summary" htmlFor="docBody" optional>
            <Textarea
              id="docBody"
              rows={5}
              value={form.body}
              onChange={(event) => update('body', event.target.value)}
              placeholder="Copy the relevant wording from the report."
            />
          </Field>

          {error ? (
            <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save record</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this record?"
        description="The record will be removed from this device and the deletion queued for your account."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Keep</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return
                store.deleteDocument(deleteTarget.id)
                setDeleteTarget(null)
                toast({ title: 'Record deleted', variant: 'success' })
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {deleteTarget ? <p className="text-sm text-muted">{deleteTarget.title}</p> : null}
      </Modal>
    </div>
  )
}

export default MedicalRecords
