import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Sparkles, LogOut, User as UserIcon, LayoutDashboard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, isHost, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: "/search", label: "Find a ride" },
    { to: "/host", label: "Host a ride" },
    { to: "/how-it-works", label: "How it works" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow group-hover:scale-105 transition-base">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Coolpool</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-base ${
                pathname === l.to
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-10 px-4 gap-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {(user.email?.[0] ?? "U").toUpperCase()}
                  </div>
                  <span className="text-sm">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/trips" className="cursor-pointer">
                    <UserIcon className="h-4 w-4 mr-2" /> My trips
                  </Link>
                </DropdownMenuItem>
                {isHost && (
                  <DropdownMenuItem asChild>
                    <Link to="/host/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="h-4 w-4 mr-2" /> Host dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Shield className="h-4 w-4 mr-2" /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild variant="hero" className="rounded-full">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden h-10 w-10 rounded-full flex items-center justify-center hover:bg-secondary"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-1 max-w-7xl">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                <Link to="/trips" onClick={() => setOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-secondary">My trips</Link>
                {isHost && <Link to="/host/dashboard" onClick={() => setOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-secondary">Host dashboard</Link>}
                {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-secondary">Admin</Link>}
                <button onClick={() => { setOpen(false); signOut(); }} className="text-left px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-secondary">Sign out</button>
              </>
            ) : (
              <Button asChild variant="hero" className="rounded-full mt-2">
                <Link to="/auth" onClick={() => setOpen(false)}>Get started</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
