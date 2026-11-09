import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { Loader2, Rotate3D, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnatomyRegion = 'cervical' | 'thoracic' | 'lumbar' | 'sacroiliac' | 'hips'

export interface RegionInfo {
  id: AnatomyRegion
  label: string
  description: string
  /**
   * Vertical centre of the region as a fraction of the model's normalised height,
   * measured from the body's mid-point (−0.5 = feet, 0 = pelvis, +0.5 = top of head).
   * Using a fraction keeps the focus correct regardless of the GLB's authored scale.
   */
  focus: number
  /** Orbit azimuth in radians, so each region can be inspected from a useful angle. */
  azimuth: number
}

export const ANATOMY_REGIONS: RegionInfo[] = [
  {
    id: 'cervical',
    label: 'Cervical spine',
    description:
      'The neck segment. In axial spondyloarthritis, neck stiffness and limited rotation are common observations — they are recorded, not diagnosed here.',
    focus: 0.36,
    azimuth: 0.35,
  },
  {
    id: 'thoracic',
    label: 'Thoracic spine',
    description:
      'The mid-back segment attached to the rib cage. Reduced chest expansion can be measured by a clinician; this viewer does not measure it.',
    focus: 0.17,
    azimuth: 0.9,
  },
  {
    id: 'lumbar',
    label: 'Lumbar spine',
    description:
      'The lower back. Pain and morning stiffness here are common in axial disease. The model is generic and is not a scan of your spine.',
    focus: 0.0,
    azimuth: 0.55,
  },
  {
    id: 'sacroiliac',
    label: 'Sacroiliac joints',
    description:
      'Where the sacrum meets the pelvis. Imaging findings must come from a radiology report — this app never infers inflammation or fusion.',
    focus: -0.08,
    azimuth: 0.7,
  },
  {
    id: 'hips',
    label: 'Hips',
    description:
      'The hip joints. Hip involvement can affect walking and function; record symptoms and let your clinician examine and image as needed.',
    focus: -0.14,
    azimuth: 0.35,
  },
]

class ViewerErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

const supportsWebGL = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Normalised model height in world units; every camera distance derives from this. */
const MODEL_HEIGHT = 2.4
const CAMERA_FOV = 38

interface ModelFraming {
  distance: number
  height: number
}

const Model = ({ onFramed }: { onFramed: (framing: ModelFraming) => void }) => {
  const { scene } = useGLTF('/models/human_anatomy.glb')
  const prepared = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    // Normalise by height so the body always spans MODEL_HEIGHT, then centre it at the origin.
    const scale = MODEL_HEIGHT / (size.y || Math.max(size.x, size.z) || 1)
    return { clone, scale, center, size: size.multiplyScalar(scale) }
  }, [scene])

  useEffect(() => {
    // Fit the model's full height plus a small margin, which is the limiting dimension
    // for a standing body (the sphere would zoom out far too much for a tall, thin figure).
    const halfHeight = prepared.size.y / 2
    const distance = (halfHeight / Math.tan((CAMERA_FOV * Math.PI) / 360)) * 1.12
    onFramed({ distance, height: MODEL_HEIGHT })
  }, [prepared, onFramed])

  return (
    <group
      scale={prepared.scale}
      position={[
        -prepared.center.x * prepared.scale,
        -prepared.center.y * prepared.scale,
        -prepared.center.z * prepared.scale,
      ]}
    >
      <primitive object={prepared.clone} />
    </group>
  )
}

interface ControlsLike {
  target: Vector3
  update: () => void
}

/**
 * Keeps the whole body in frame, then orbits around the selected region instead of
 * teleporting the camera to guessed absolute coordinates.
 */
const CameraRig = ({
  framing,
  focus,
  azimuth,
}: {
  framing: ModelFraming | null
  focus: number
  azimuth: number
}) => {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as ControlsLike | null

  useEffect(() => {
    if (!framing) return
    const target = new Vector3(0, focus * framing.height, 0)
    // Pull back slightly for the upper body so the head is never clipped.
    const distance = framing.distance * (focus > 0.2 ? 1.08 : 1)
    camera.position.set(
      Math.sin(azimuth) * distance,
      target.y + distance * 0.12,
      Math.cos(azimuth) * distance,
    )
    camera.near = distance / 100
    camera.far = distance * 10
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.update()
    } else {
      camera.lookAt(target)
    }
  }, [camera, controls, framing, focus, azimuth])

  return null
}

const Loading = () => (
  <div className="flex h-full items-center justify-center gap-2 text-xs text-white/60">
    <Loader2 className="size-4 animate-spin" aria-hidden /> Loading educational anatomy model…
  </div>
)

const Fallback = ({ reason }: { reason: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
    <img
      src="/anatomy-fallback.jpg"
      alt="Static reference illustration shown when the interactive anatomy model is unavailable"
      className="max-h-[260px] w-auto rounded-xl object-contain"
      width={260}
      height={260}
    />
    <p className="max-w-sm text-[11px] leading-relaxed text-muted">{reason}</p>
  </div>
)

export const AnatomyViewer = ({ region }: { region: AnatomyRegion }) => {
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [framing, setFraming] = useState<ModelFraming | null>(null)

  useEffect(() => {
    setWebgl(supportsWebGL())
  }, [])

  const active = ANATOMY_REGIONS.find((item) => item.id === region) ?? ANATOMY_REGIONS[2]
  const fallbackReason =
    'Interactive 3D could not start on this device. A static reference illustration is shown instead; the written anatomy notes and the rest of the app still work.'

  if (webgl === null) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl bg-navy-950 sm:h-[440px]">
        <Loading />
      </div>
    )
  }

  if (!webgl) {
    return (
      <div className="h-[360px] rounded-2xl border border-navy-900/10 bg-card p-4 sm:h-[440px] dark:border-white/10">
        <Fallback reason={fallbackReason} />
      </div>
    )
  }

  return (
    <div
      className="relative h-[360px] w-full overflow-hidden rounded-2xl bg-navy-950 sm:h-[440px]"
      role="img"
      aria-label={`Interactive educational model of the human spine and pelvis, focused on the ${active.label}. Drag to rotate, scroll or pinch to zoom.`}
    >
      <ViewerErrorBoundary
        fallback={
          <div className="h-full">
            <Fallback reason={fallbackReason} />
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 0.4, 5], fov: CAMERA_FOV, near: 0.05, far: 24 }}
          dpr={[1, 1.75]}
          frameloop="demand"
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor('#0a1420')}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 4]} intensity={1.6} />
          <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#75d8c5" />
          <Suspense fallback={null}>
            <Model onFramed={setFraming} />
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            minDistance={1.2}
            maxDistance={8}
          />
          <CameraRig framing={framing} focus={active.focus} azimuth={active.azimuth} />
        </Canvas>
      </ViewerErrorBoundary>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-xl bg-navy-950/70 px-3 py-2 text-[10px] font-medium text-white/70 backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <Rotate3D className="size-3.5" aria-hidden /> Drag to rotate · pinch to zoom
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ScanLine className="size-3.5" aria-hidden /> {active.label}
        </span>
      </div>
      <div className="absolute left-3 top-3 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">
        Generic educational model
      </div>
    </div>
  )
}

export const anatomyRegionClass = (isActive: boolean) =>
  cn(
    'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
    isActive
      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
      : 'border-navy-900/10 hover:bg-navy-900/5 dark:border-white/10 dark:hover:bg-white/10',
  )

useGLTF.preload('/models/human_anatomy.glb')
