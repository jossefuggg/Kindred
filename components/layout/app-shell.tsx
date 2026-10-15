import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, Compass, LayoutDashboard, LogOut, Moon, Shield, Sun, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const nav = [
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/charities", label: "Charities", icon: Building2 },
    { to: "/courses", label: "Learn", icon: BookOpen },
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/me", label: "Profile", icon: UserRound },
  ] as const;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut({ scope: "local" });
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/explore" aria-label="Kindred home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-full px-4 py-2 text-sm font-semibold text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text"
                activeProps={{ className: "bg-brand-soft text-brand" }}
              >
                {n.label}
              </Link>
            ))}
            {hasRole("admin") && (
              <Link
                to="/admin"
                className="rounded-full px-4 py-2 text-sm font-semibold text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text"
                activeProps={{ className: "bg-brand-soft text-brand" }}
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {hasRole("admin") && (
              <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Admin">
                <Link to="/admin">
                  <Shield />
                </Link>
              </Button>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface md:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-text-3"
            activeProps={{ className: "text-brand" }}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
