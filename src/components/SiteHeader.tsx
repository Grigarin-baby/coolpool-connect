import { Link, useRouterState } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
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
    <>
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 pointer-events-none">
        <header 
          className="container mx-auto max-w-7xl h-20 rounded-full border border-white/20 bg-background/60 backdrop-blur-2xl shadow-glow-sm pointer-events-auto flex items-center justify-between px-6 sm:px-8 transition-all duration-500 hover:shadow-glow-md"
        >
          <Link to="/" className="flex items-center gap-3 group transition-transform duration-300 hover:scale-[1.02]">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/40 transition-colors" />
              <img src={logo} alt="Coolpool" className="h-16 w-auto object-contain relative z-10 mix-blend-multiply" />
            </div>
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
            className="md:hidden h-12 w-12 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-2xl md:hidden p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-end mb-8">
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full">
              <X className="h-8 w-8" />
            </Button>
          </div>
          <div className="flex flex-col gap-6 text-center">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-3xl font-black tracking-tighter uppercase hover:text-primary transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-border/60 my-2" />
            {user ? (
              <>
                {dashboardPath && (
                  <Link
                    to={dashboardPath}
                    onClick={() => setOpen(false)}
                    className="text-2xl font-bold hover:text-primary transition-colors"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  to="/trips"
                  onClick={() => setOpen(false)}
                  className="text-2xl font-bold hover:text-primary transition-colors"
                >
                  My trips
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="text-2xl font-bold text-destructive"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="text-2xl font-bold hover:text-primary transition-colors"
              >
                Login / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

