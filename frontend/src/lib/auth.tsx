import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api, ApiError } from "./api"

export type User = {
  id: number
  username: string
  role: string
  created_at: string
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<User>("/auth/me")
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((err) => {
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.error("auth bootstrap failed", err)
        }
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function login(username: string, password: string) {
    const u = await api.post<User>("/auth/login", { username, password })
    setUser(u)
    return u
  }

  async function logout() {
    try {
      await api.post("/auth/logout")
    } catch {
      // best effort
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
