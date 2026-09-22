import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, homeForRole, useAuth } from './auth/AuthContext'
import { ToastProvider } from './components/Toast'
import { AppShell } from './components/AppShell'
import LoginPage from './pages/LoginPage'
import SubmitPage from './pages/SubmitPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import type { Role } from './lib/apiTypes'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireRoles({ allowed, children }: { allowed: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />
  }
  return children
}

function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-full w-full bg-canvas font-sans text-ink">
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route
                  path="/submit"
                  element={
                    <RequireRoles allowed={['warehouse_manager', 'admin']}>
                      <SubmitPage />
                    </RequireRoles>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <RequireRoles allowed={['executive', 'admin']}>
                      <DashboardPage />
                    </RequireRoles>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireRoles allowed={['admin']}>
                      <AdminPage />
                    </RequireRoles>
                  }
                />
              </Route>
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
