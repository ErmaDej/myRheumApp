import { useMemo, useRef, useState } from 'react'
import { Camera, GitCompareArrows, Images, LockKeyhole, Trash2, TriangleAlert } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { useToast } from '@/hooks/useToast'
import type { PhotoView, ProgressPhoto } from '@/data/types'
import { compressImage } from '@/lib/images'
import {
  Badge,
  Button,
  Card,
  CardHeader,
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

const VIEWS: Array<{ value: PhotoView; label: string }> = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
  { value: 'other', label: 'Other' },
]

export const PhotoJournal = () => {
  const { state, store } = useData()
  const { toast } = useToast()
  const { data } = state

  const [open, setOpen] = useState(false)
  const [takenOn, setTakenOn] = useState(todayInputValue())
  const [view, setView] = useState<PhotoView>('front')
  const [notes, setNotes] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProgressPhoto | null>(null)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [comparePosition, setComparePosition] = useState(50)
  const fileRef = useRef<HTMLInputElement>(null)

  const photos = useMemo(
    () => [...data.photos].sort((a, b) => b.takenOn.localeCompare(a.takenOn)),
    [data.photos],
  )

  const photoA = photos.find((photo) => photo.id === compareA) ?? photos[photos.length - 1]
  const photoB = photos.find((photo) => photo.id === compareB) ?? photos[0]

  const resetForm = () => {
    setTakenOn(todayInputValue())
    setView('front')
    setNotes('')
    setDataUrl(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const compressed = await compressImage(file)
      setDataUrl(compressed.dataUrl)
      toast({
        title: 'Photo prepared',
        description: `${compressed.width}×${compressed.height} · kept on this device only.`,
        variant: 'info',
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not process this image.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!dataUrl) {
      setError('Choose a photograph first.')
      return
    }
    store.savePhoto({
      id: uid('photo'),
      patientId: data.profile.id,
      takenOn: new Date(`${takenOn}T12:00:00`).toISOString(),
      view,
      dataUrl,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    toast({
      title: 'Photograph saved privately',
      description: 'Stored on this device only. It is never beautified or structurally interpreted.',
      variant: 'success',
    })
    setOpen(false)
    resetForm()
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Photo journal"
        description="Dated, private comparison photographs. Capture the same view, in similar light and posture, to make comparisons fair."
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Camera className="size-3.5" aria-hidden /> Add photograph
          </Button>
        }
      />

      <InlineAlert tone="warning" title="Highly sensitive images">
        Photographs stay in this browser (IndexedDB) and are deliberately not uploaded or synced in this build.
        They are not beautified, reshaped or analysed, and no spinal alignment or inflammation is inferred from
        them. Delete them if the device is shared.
      </InlineAlert>

      {/* Comparison */}
      {photos.length >= 2 ? (
        <Card className="p-4 sm:p-5">
          <CardHeader
            title="Dated comparison"
            subtitle="Drag the slider to compare a baseline and follow-up capture."
            action={<GitCompareArrows className="size-4 text-muted" aria-hidden />}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Earlier capture" htmlFor="compareA">
              <Select id="compareA" value={photoA?.id ?? ''} onChange={(event) => setCompareA(event.target.value)}>
                {[...photos].reverse().map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {formatDate(photo.takenOn)} · {photo.view}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Later capture" htmlFor="compareB">
              <Select id="compareB" value={photoB?.id ?? ''} onChange={(event) => setCompareB(event.target.value)}>
                {photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {formatDate(photo.takenOn)} · {photo.view}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {photoA && photoB ? (
            <>
              <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-navy-950">
                <img
                  src={photoA.dataUrl}
                  alt={`Earlier capture from ${formatDate(photoA.takenOn)}`}
                  className="absolute inset-0 size-full object-contain"
                />
                <img
                  src={photoB.dataUrl}
                  alt={`Later capture from ${formatDate(photoB.takenOn)}`}
                  className="absolute inset-0 size-full object-contain"
                  style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-teal-400"
                  style={{ left: `${comparePosition}%` }}
                  aria-hidden
                />
                <div className="absolute left-2 top-2 rounded-md bg-navy-950/70 px-2 py-1 text-[10px] font-semibold text-white">
                  {formatDate(photoA.takenOn)}
                </div>
                <div className="absolute right-2 top-2 rounded-md bg-navy-950/70 px-2 py-1 text-[10px] font-semibold text-white">
                  {formatDate(photoB.takenOn)}
                </div>
              </div>
              <label className="mt-2 block text-xs font-medium text-muted" htmlFor="compareSlider">
                Comparison position
              </label>
              <input
                id="compareSlider"
                type="range"
                min={0}
                max={100}
                value={comparePosition}
                onChange={(event) => setComparePosition(Number(event.target.value))}
                className="mt-1 w-full accent-teal-600"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Photographs are compared only for the user's own reference. Posture, lighting and framing can
                change the appearance without any change in disease.
              </p>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* Gallery */}
      {photos.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<Images className="size-5" aria-hidden />}
            title="No photographs yet"
            description="Add a baseline capture from the front, side and back if you choose. All views are optional."
            action={<Button size="sm" onClick={() => setOpen(true)}>Add baseline photo</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setDetail(photo)}
              className="group overflow-hidden rounded-2xl border border-navy-900/10 bg-card text-left shadow-sm transition hover:shadow-md dark:border-white/10"
            >
              <div className="aspect-square overflow-hidden bg-navy-950">
                <img
                  src={photo.dataUrl}
                  alt={`${photo.view} view from ${formatDate(photo.takenOn)}`}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-ink">{formatDate(photo.takenOn)}</p>
                <div className="mt-1 flex items-center justify-between">
                  <Badge tone="neutral">{photo.view}</Badge>
                  <LockKeyhole className="size-3 text-muted" aria-label="Stored locally only" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          resetForm()
        }}
        title="Add a private photograph"
        description="Use consistent lighting, distance and posture. Do not edit or beautify the image."
      >
        <div className="space-y-4">
          <Field label="Photograph" htmlFor="photoFile" hint="JPEG, PNG or WebP up to 15 MB. Downscaled once, otherwise untouched.">
            <input
              ref={fileRef}
              id="photoFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              className="block w-full cursor-pointer rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-xs text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:border-white/15 dark:bg-navy-900/50"
            />
          </Field>

          {busy ? <p className="text-xs text-muted">Preparing image…</p> : null}

          {dataUrl ? (
            <div className="overflow-hidden rounded-xl border border-navy-900/10 dark:border-white/10">
              <img src={dataUrl} alt="Preview of selected photograph" className="max-h-64 w-full object-contain bg-navy-950" />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Capture date" htmlFor="takenOn">
              <Input
                id="takenOn"
                type="date"
                value={takenOn}
                max={todayInputValue()}
                onChange={(event) => setTakenOn(event.target.value)}
              />
            </Field>
            <Field label="View" htmlFor="photoView">
              <Select
                id="photoView"
                value={view}
                onChange={(event) => setView(event.target.value as PhotoView)}
              >
                {VIEWS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="photoNotes" optional hint="Describe posture, pain or context — not a diagnosis.">
            <Textarea
              id="photoNotes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Same distance, morning light, before stretching."
            />
          </Field>

          {error ? (
            <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {error}
            </p>
          ) : null}

          <InlineAlert tone="danger" title="Before you save">
            These images are highly sensitive. They stay on this device and are never placed in a public URL.
            Avoid photographing identifying features or documents.
          </InlineAlert>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !dataUrl}>
              Save photograph
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.view} view · ${formatDate(detail.takenOn)}` : 'Photograph'}
        description="Stored locally on this device."
        wide
      >
        {detail ? (
          <div className="space-y-3">
            <img
              src={detail.dataUrl}
              alt={`${detail.view} view from ${formatDate(detail.takenOn)}`}
              className="max-h-[60dvh] w-full rounded-xl bg-navy-950 object-contain"
            />
            {detail.notes ? <p className="text-xs leading-relaxed text-muted">{detail.notes}</p> : null}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />
                Not a clinical image analysis.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  store.deletePhoto(detail.id)
                  setDetail(null)
                  toast({ title: 'Photograph deleted', variant: 'success' })
                }}
              >
                <Trash2 className="size-3.5" aria-hidden /> Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Card className={cn('flex items-start gap-3 p-4 text-[11px] leading-relaxed text-muted')}>
        <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Clear local data from Settings to remove every photograph from this browser. Deleting a photograph here
          does not affect any other device.
        </p>
      </Card>
    </div>
  )
}

export default PhotoJournal
