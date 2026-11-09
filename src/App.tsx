import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/app/routes'
import { AppErrorBoundary } from '@/app/ErrorBoundary'

function App() {
  return (
    <AppProviders>
      <AppErrorBoundary>
        <AppRoutes />
      </AppErrorBoundary>
    </AppProviders>
  )
}

export default App
