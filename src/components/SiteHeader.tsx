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
import { memberPortalLinkSearch } from "@/lib/travelerResumeRedirect";

const navLinks = [{ to: "/" as const, label: "Home" }];

export function SiteHeader() {
  const { user, isDriver, isAdmin, signOut } = useAuth();
  const memberSearch = useRouterState({
    select: (r) => {
      const search = memberPortalLinkSearch(r.location.href);
      return { redirect: search.redirect, google_auth: undefined as undefined };
    },
  });
  const [open, setOpen] = useState(false);
  const dashboardPath = isAdmin ? "/admin/dashboard" : isDriver ? "/driver/dashboard" : null;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-none bg-gradient-primary flex items-center justify-center shadow-glow group-hover:scale-105 transition-base">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight">Coolpool</span>
        </Link>


        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {dashboardPath && (
                <Button asChild variant="hero" className="rounded-none">
                  <Link to={dashboardPath}>
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-none h-10 px-4 gap-2">
                    <div className="h-7 w-7 rounded-none bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {(user.email?.[0] ?? "U").toUpperCase()}
                    </div>
                    <span className="text-sm">Account</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-none">
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/trips" className="cursor-pointer">
                      <UserIcon className="h-4 w-4 mr-2" /> My trips
                    </Link>
                  </DropdownMenuItem>
                  {isDriver && (
                    <DropdownMenuItem asChild>
                      <Link to="/driver/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="h-4 w-4 mr-2" /> Ride Host dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/dashboard" className="cursor-pointer">
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
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="rounded-none border-border/80 bg-card/40">
                {/* <Link to="/members" search={memberSearch}>
                  Become a member
                </Link> */}
              </Button>
              <Button asChild variant="ghost" className="rounded-none">
                <Link to="/auth">Login</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden h-10 w-10 rounded-none flex items-center justify-center hover:bg-secondary"
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
                className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                {dashboardPath && (
                  <Link
                    to={dashboardPath}
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  to="/trips"
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
                >
                  My trips
                </Link>
                {isDriver && (
                  <Link
                    to="/driver/dashboard"
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
                  >
                    Ride Host dashboard
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="text-left px-4 py-3 rounded-none text-sm font-medium text-destructive hover:bg-secondary"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/members"
                  search={memberSearch}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
                >
                  Become a member
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-none text-sm font-medium hover:bg-secondary"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

