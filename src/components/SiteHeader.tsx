import { Link, useRouterState } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { useState } from "react";
import {
  Menu,
  X,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Shield,
  Ticket,
  Home,
  ChevronRight,
} from "lucide-react";
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
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { getUserDisplayName, getUserInitial } from "@/lib/user-display";

const navLinks = [{ to: "/" as const, label: "Home" }];

export function SiteHeader() {
  const { user, isDriver, isAdmin, signOut, roles } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const memberSearch = useRouterState({
    select: (r) => {
      const search = memberPortalLinkSearch(r.location.href);
      return { redirect: search.redirect, google_auth: undefined as undefined };
    },
  });
  const [open, setOpen] = useState(false);
  const dashboardPath = isAdmin ? "/admin/dashboard" : isDriver ? "/driver/dashboard" : null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 pointer-events-none">
        <header className="container mx-auto max-w-7xl h-20 rounded-full border border-white/20 bg-background/60 backdrop-blur-2xl shadow-glow-sm pointer-events-auto flex items-center justify-between px-6 sm:px-8 transition-all duration-500 hover:shadow-glow-md">
          <Link
            to="/"
            className="flex items-center gap-3 group transition-transform duration-300 hover:scale-[1.02]"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/40 transition-colors" />
              <img src={logo} alt="Coolpool" className="h-16 w-auto object-contain relative z-10" />
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {/* My trips — always shown; routes to traveler login when signed out */}
            <Button asChild variant="ghost" className="rounded-3xl">
              {user ? (
                <Link to="/trips">
                  <Ticket className="h-4 w-4 mr-2" />
                  My trips
                </Link>
              ) : (
                <Link to="/members" search={memberSearch}>
                  <Ticket className="h-4 w-4 mr-2" />
                  My trips
                </Link>
              )}
            </Button>

            {/* Dashboard — hidden for members; routes to host login when signed out */}
            {!user ? (
              <Button asChild variant="hero" className="rounded-3xl">
                <Link to="/auth">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Host dashboard
                </Link>
              </Button>
            ) : dashboardPath ? (
              <Button asChild variant="hero" className="rounded-3xl">
                <Link to={dashboardPath}>
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  {isAdmin ? "Admin" : "Host dashboard"}
                </Link>
              </Button>
            ) : null}

            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="rounded-3xl h-10 px-4 gap-2">
                      <div className="h-7 w-7 rounded-3xl bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                        {getUserInitial(user)}
                      </div>
                      <span className="text-sm max-w-[120px] truncate">
                        {getUserDisplayName(user)}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-3xl">
                    <DropdownMenuLabel className="font-normal space-y-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {getUserDisplayName(user)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => setProfileOpen(true)}
                    >
                      <UserIcon className="h-4 w-4 mr-2" /> My profile
                    </DropdownMenuItem>
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
              <Button asChild variant="ghost" className="rounded-3xl">
                <Link to="/auth">Login</Link>
              </Button>
            )}
          </div>

          <button
            className="md:hidden h-12 w-12 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Panel */}
          <div className="absolute inset-x-0 top-0 bg-background rounded-b-3xl shadow-2xl border-b border-border/40 px-5 pt-5 pb-6 animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between mb-5">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2"
              >
                <img src={logo} alt="Coolpool" className="h-12 w-auto object-contain" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {user && (
              <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3 mb-4">
                <div className="h-11 w-11 rounded-2xl bg-gradient-primary flex items-center justify-center text-base font-bold text-primary-foreground shrink-0">
                  {getUserInitial(user)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{getUserDisplayName(user)}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            )}

            <nav className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-muted active:scale-[0.98] transition-all"
                >
                  <Home className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="flex-1">{l.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </Link>
              ))}

              {user ? (
                <>
                  <Link
                    to="/trips"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-muted active:scale-[0.98] transition-all"
                  >
                    <Ticket className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="flex-1">My trips</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </Link>
                  {dashboardPath && (
                    <Link
                      to={dashboardPath}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-muted active:scale-[0.98] transition-all"
                    >
                      {isAdmin ? (
                        <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
                      ) : (
                        <LayoutDashboard className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1">
                        {isAdmin ? "Admin dashboard" : "Host dashboard"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setProfileOpen(true);
                    }}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-muted active:scale-[0.98] transition-all text-left"
                  >
                    <UserIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="flex-1">My profile</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/members"
                    search={memberSearch}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-muted active:scale-[0.98] transition-all"
                  >
                    <Ticket className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="flex-1">My trips</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-muted active:scale-[0.98] transition-all"
                  >
                    <LayoutDashboard className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="flex-1">Host dashboard</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </Link>
                </>
              )}
            </nav>

            <div className="h-px bg-border/60 my-4" />

            {user ? (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full rounded-2xl h-12 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            ) : (
              <Button asChild variant="hero" className="w-full rounded-2xl h-12 text-base">
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Login / Register
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        roles={roles}
      />
    </>
  );
}
