import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui'
import { useAuth } from '@/data/auth'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Onboarding } from '@/pages/Onboarding'
import { lazyWithRetry } from './lazyWithRetry'

const Dashboard = lazyWithRetry(() => import('@/pages/Dashboard'), 'Dashboard')
const HealthJournal = lazyWithRetry(() => import('@/pages/HealthJournal'), 'HealthJournal')
const Measurements = lazyWithRetry(() => import('@/pages/Measurements'), 'Measurements')
const Laboratory = lazyWithRetry(() => import('@/pages/Laboratory'), 'Laboratory')
const Medications = lazyWithRetry(() => import('@/pages/Medications'), 'Medications')
const Appointments = lazyWithRetry(() => import('@/pages/Appointments'), 'Appointments')
const Progress = lazyWithRetry(() => import('@/pages/Progress'), 'Progress')
const MedicalRecords = lazyWithRetry(() => import('@/pages/MedicalRecords'), 'MedicalRecords')
const PhotoJournal = lazyWithRetry(() => import('@/pages/PhotoJournal'), 'PhotoJournal')
const Reports = lazyWithRetry(() => import('@/pages/Reports'), 'Reports')
const Anatomy = lazyWithRetry(() => import('@/pages/Anatomy'), 'Anatomy')
const SettingsPage = lazyWithRetry(() => import('@/pages/Settings'), 'Settings')

const PageSkeleton = () => (
  <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading page">
    <Skeleton className="h-24 w-full" />
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
    <Skeleton className="h-56 w-full" />
  </div>
)

const BootScreen = () => (
  <div className="flex min-h-dvh items-center justify-center bg-surface" aria-busy="true">
    <div className="flex flex-col items-center gap-3">
      <div className="size-12 animate-pulse-soft rounded-2xl bg-teal-400" aria-hidden />
      <p className="text-sm font-medium text-muted">Opening your journal…</p>
    </div>
  </div>
)

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <BootScreen />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

const withSuspense = (node: ReactNode) => <Suspense fallback={<PageSkeleton />}>{node}</Suspense>

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      path="/onboarding"
      element={
        <RequireAuth>
          {withSuspense(<Onboarding />)}
        </RequireAuth>
      }
    />
    <Route
      element={
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      }
    >
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={withSuspense(<Dashboard />)} />
      <Route path="/health-journal" element={withSuspense(<HealthJournal />)} />
      <Route path="/measurements" element={withSuspense(<Measurements />)} />
      <Route path="/laboratory" element={withSuspense(<Laboratory />)} />
      <Route path="/medications" element={withSuspense(<Medications />)} />
      <Route path="/appointments" element={withSuspense(<Appointments />)} />
      <Route path="/progress" element={withSuspense(<Progress />)} />
      <Route path="/medical-records" element={withSuspense(<MedicalRecords />)} />
      <Route path="/photo-journal" element={withSuspense(<PhotoJournal />)} />
      <Route path="/reports" element={withSuspense(<Reports />)} />
      <Route path="/anatomy" element={withSuspense(<Anatomy />)} />
      <Route path="/settings" element={withSuspense(<SettingsPage />)} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
)
