import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser, RenuziApi, Role } from '../lib/apiTypes'
import { getApi, getStoredUser, isMockMode, saveSession, clearSession } from '../lib/api'

export function homeForRole(role: Role): string {
  if (role === 'warehouse_manager') return '/submit'
  return '/dashboard'
}

interface AuthContextValue {
  user: AuthUser | null
  mockMode: boolean
  api: RenuziApi
  login: (email: string, password: string) => Promise<AuthUser>
  loginAs: (email: string) => Promise<AuthUser>
  logout: () => void
  /** True when `allowed` includes the signed-in role (false when signed out). */
  can: (allowed: Role[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const mockMode = isMockMode()
  const api = getApi()

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const result = await api.login(email, password)
      saveSession(result.token, result.user)
      setUser(result.user)
      return result.user
    },
    [api]
  )

  const loginAs = useCallback(
    async (email: string): Promise<AuthUser> => login(email, 'demo'),
    [login],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const can = useCallback(
    (allowed: Role[]) => (user ? allowed.includes(user.role) : false),
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, mockMode, api, login, loginAs, logout, can }),
    [user, mockMode, api, login, loginAs, logout, can],
  )
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
