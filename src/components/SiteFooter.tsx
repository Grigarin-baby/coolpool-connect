import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Coolpool</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm">
              Smart intercity ride-sharing — fair prices, friendly hosts, every kilometer counted.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/search" className="hover:text-foreground transition-base">Find a ride</Link></li>
              <li><Link to="/host" className="hover:text-foreground transition-base">Host a ride</Link></li>
              <li><Link to="/how-it-works" className="hover:text-foreground transition-base">How it works</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-base">About</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-base">Help</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-base">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Coolpool. All rights reserved.</p>
          <p>Built for travelers and hosts who care about the journey.</p>
        </div>
      </div>
    </footer>
  );
}
