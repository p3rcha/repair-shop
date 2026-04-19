import { Link, Outlet, useNavigate } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link
            to="/estimates"
            className="font-mono text-2xl font-semibold tracking-tight md:text-3xl"
          >
            Repair Shop
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:inline">
                {user.username}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <HugeiconsIcon icon={Logout02Icon} />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
