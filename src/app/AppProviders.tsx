import type { ReactNode } from 'react'
import { AuthProvider, type SessionUser } from '@/data/auth'
import { DataProvider } from '@/data/DataProvider'
import type { AppStore } from '@/data/store'
import { ThemeProvider } from '@/hooks/useTheme'
import { ToastProvider } from '@/hooks/useToast'

export const AppProviders = ({
  children,
  authUser = null,
  store,
}: {
  children: ReactNode
  authUser?: SessionUser | null
  store?: AppStore
}) => (
  <ThemeProvider>
    <ToastProvider>
      <AuthProvider initialUser={authUser}>
        <DataProvider store={store}>{children}</DataProvider>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
)
