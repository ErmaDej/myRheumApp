import { useState } from 'react'
import { Bone, Info, ShieldAlert } from 'lucide-react'
import { AnatomyViewer, ANATOMY_REGIONS, anatomyRegionClass, type AnatomyRegion } from '@/components/anatomy/AnatomyViewer'
import { Badge, Card, CardHeader, InlineAlert, SectionHeader } from '@/components/ui'

export const Anatomy = () => {
  const [region, setRegion] = useState<AnatomyRegion>('lumbar')
  const active = ANATOMY_REGIONS.find((item) => item.id === region) ?? ANATOMY_REGIONS[2]

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Anatomy explorer"
        description="A generic educational model of the spine and pelvis. It is not a scan of your body and cannot show inflammation, fusion or structural change."
        action={<Badge tone="lavender"><Bone className="size-3" aria-hidden /> Optional 3D</Badge>}
      />

      <InlineAlert tone="warning" title="What this viewer is — and is not">
        This is an optional learning aid loaded only when you open this page. Imaging findings and structural
        changes must come from a radiology report and your clinician. Symptoms and photographs are never used to
        infer spinal fusion or inflammation.
      </InlineAlert>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-3 sm:p-4">
          <AnatomyViewer region={region} />
          <p className="mt-3 flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Model loads on demand and is cached for offline use after the first visit. If WebGL is unavailable
            the page falls back to a static reference illustration.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <CardHeader title="Explore a region" subtitle="Select a region to focus the camera and read its note." />
            <div className="mt-3 space-y-2">
              {ANATOMY_REGIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={region === item.id}
                  onClick={() => setRegion(item.id)}
                  className={anatomyRegionClass(region === item.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{item.label}</span>
                    {region === item.id ? <Badge tone="teal">Focused</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 text-[11px] leading-relaxed text-muted sm:p-5">
            <p className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <span>
                <strong className="font-semibold text-ink">Focused region:</strong> {active.label}. This label is
                educational only. It is not a clinical finding, and selecting a region does not mean the region
                is affected.
              </span>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Anatomy
