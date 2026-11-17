import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: 'principal' | 'admin' | 'empleado'
  active: boolean
  permissions: Record<string, boolean>
}

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: (username: string, pin: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  isAdmin: boolean
}

const TOKEN_KEY = 'panaderia-lela-token'
const AuthContext = createContext<AuthContextValue | null>(null)

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // ignore
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [token])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          await logout()
        } else {
          const data = (await res.json()) as { user: AuthUser }
          if (!cancelled) setUser(data.user)
        }
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token, logout])

  const login = useCallback(async (username: string, pin: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      })
      const data = (await res.json()) as {
        ok: boolean
        token?: string
        user?: AuthUser
        error?: string
      }
      if (!data.ok || !data.token || !data.user) {
        return { ok: false, error: 'Usuario o PIN incorrecto.' }
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      return { ok: true }
    } catch {
      return {
        ok: false,
        error: 'No se pudo contactar al servidor.',
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === 'admin' || user?.role === 'principal',
    }),
    [token, user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requiere AuthProvider')
  return ctx
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
