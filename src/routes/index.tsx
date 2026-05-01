import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  ShieldCheck,
  Zap,
  Heart,
  Clock3,
  Route as RouteIcon,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coolpool — Share the road, split the cost" },
      {
        name: "description",
        content:
          "Find or host intercity rides with smart per-kilometer pricing. Book a single seat or the whole car.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 bg-gradient-mesh opacity-80 pointer-events-none" />
        <div className="absolute top-0 right-0 h-[18rem] w-[18rem] rounded-full bg-primary-glow/30 blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 pt-14 pb-20 md:pt-20 md:pb-24 max-w-7xl relative">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-lg bg-card/70 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-muted-foreground border border-border/60 shadow-soft">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Built for intercity rides with dynamic per-km pricing
              </div>
              <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.02]">
                Share the road,
                <br />
                <span className="text-gradient-primary">split the fun.</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
                Coolpool connects Ride Hosts and Travelers on the same intercity route. Book only
                your segment, pay only for your distance, and travel with verified profiles.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild variant="hero" size="xl">
                  <Link to="/search">
                    Find a ride <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl" className="bg-card/50">
                  <Link to="/host">Host a ride</Link>
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                <TrustPill icon={<RouteIcon className="h-4 w-4" />} text="Route-based matching" />
                <TrustPill icon={<Wallet className="h-4 w-4" />} text="Fair per-km pricing" />
                <TrustPill icon={<ShieldCheck className="h-4 w-4" />} text="Role-based access" />
              </div>
            </div>

            <Card className="hidden lg:block rounded-2xl border-border/60 bg-card/85 backdrop-blur-xl p-5 shadow-elevated">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Live route preview
              </p>
              <div className="mt-4 rounded-xl border border-border/60 bg-secondary/50 p-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Bengaluru</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>Mysuru</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-background">
                  <div className="h-2 w-3/4 rounded-full bg-gradient-primary" />
                </div>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>2 pickups</span>
                  <span>145 km</span>
                  <span>2h 45m</span>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <TripPreviewItem title="Seat pricing" value="From ₹3.50/km" />
                <TripPreviewItem title="Seats left" value="3 of 4" />
                <TripPreviewItem title="Host rating" value="4.9 / 5.0" />
              </div>
              <Button asChild variant="hero" className="mt-5 w-full">
                <Link to="/search">Book this route</Link>
              </Button>
            </Card>
          </div>

          {/* QUICK SEARCH CARD */}
     
        </div>
      </section>

      {/* PROOF STRIP */}
      <section className="container mx-auto px-4 py-8 md:py-10 max-w-7xl">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { value: "3-5 km", label: "route match tolerance" },
            { value: "Per segment", label: "seat conflict handling" },
            { value: "Dynamic", label: "price recalculation for new bookings" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border/60 bg-card/70 px-4 py-4 text-center shadow-soft"
            >
              <p className="text-base font-semibold">{item.value}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">
            How it works
          </p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">
            A smarter way to travel together
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <MapPin className="h-6 w-6" />,
              title: "Search your route",
              text: "Choose pickup, drop, date, and seats. We show rides passing close to both points on route.",
            },
            {
              icon: <Users className="h-6 w-6" />,
              title: "Book just the seats you need",
              text: "Pick your segment and seats. Price is calculated from route distance and host's current per-km rate.",
            },
            {
              icon: <Heart className="h-6 w-6" />,
              title: "Ride and rate",
              text: "Track upcoming trips, meet at pickup points, and rate hosts to keep the network reliable.",
            },
          ].map((step, i) => (
            <Card
              key={i}
              className="p-8 rounded-2xl border-border/60 shadow-card hover:shadow-elevated transition-base group"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow group-hover:scale-105 transition-base">
                {step.icon}
              </div>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* VALUE FOR BOTH ROLES */}
      <section className="container mx-auto px-4 pb-16 md:pb-20 max-w-7xl">
        <div className="grid gap-6 md:grid-cols-2">
          <RoleCard
            icon={<Clock3 className="h-10 w-10 text-primary" />}
            title="For Travelers"
            text="Reach intercity destinations with route-matched rides, transparent segment pricing, and easy repeat booking."
            bullets={[
              "Book by segment, not full route",
              "Save passenger details for quick checkout",
              "View upcoming rides in one place",
            ]}
            ctaTo="/search"
            ctaLabel="Find a ride"
            emphasis="soft"
          />
          <RoleCard
            icon={<Zap className="h-10 w-10 text-primary" />}
            title="For Ride Hosts"
            text="Post your trip once, add intermediate stops, and fill spare seats without manual pricing calculations."
            bullets={[
              "Set total trip price, system derives per-km",
              "Manage bookings and pickups from dashboard",
              "Update future pricing while preserving old bookings",
            ]}
            ctaTo="/host"
            ctaLabel="Host a ride"
            emphasis="default"
          />
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="container mx-auto px-4 pb-16 md:pb-20 max-w-7xl">
        <Card className="p-10 md:p-14 rounded-2xl bg-gradient-primary text-primary-foreground shadow-elevated overflow-hidden relative border-0">
          <div className="absolute inset-0 bg-gradient-mesh opacity-30 mix-blend-overlay pointer-events-none" />
          <div className="relative grid gap-8 md:grid-cols-3 text-center">
            {[
              { stat: "₹3.50", label: "Average per km" },
              { stat: "4.9★", label: "Host rating" },
              { stat: "60%", label: "Cheaper than cabs" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-5xl md:text-6xl font-bold tracking-tight">{s.stat}</div>
                <div className="mt-2 text-primary-foreground/80">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 pb-24 max-w-7xl">
        <Card className="rounded-2xl border-border/60 p-8 md:p-12 bg-card shadow-card">
          <div className="max-w-3xl">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight">
              Plan your next intercity ride in under a minute.
            </h3>
            <p className="mt-3 text-muted-foreground">
              Search active rides or create your own route. Coolpool handles distance-aware pricing
              and segment seat logic.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="hero" size="lg" className="rounded-xl">
                <Link to="/search">
                  Start with search <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-xl">
                <Link to="/host">Create a host trip</Link>
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <SiteFooter />
    </div>
  );
}

function TripPreviewItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function TrustPill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-sm shadow-soft">
      <span className="text-primary">{icon}</span>
      <span className="text-foreground/90">{text}</span>
    </div>
  );
}

function QuickField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/60 transition-base cursor-pointer">
      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  text,
  bullets,
  ctaTo,
  ctaLabel,
  emphasis,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  bullets: string[];
  ctaTo: "/search" | "/host";
  ctaLabel: string;
  emphasis: "soft" | "default";
}) {
  return (
    <Card
      className={`p-8 md:p-10 rounded-2xl border-border/60 overflow-hidden relative ${
        emphasis === "soft" ? "bg-gradient-soft" : "bg-card"
      }`}
    >
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary-glow/20 blur-3xl pointer-events-none" />
      <div className="relative">
        {icon}
        <h3 className="mt-4 text-2xl md:text-3xl font-bold">{title}</h3>
        <p className="mt-3 text-muted-foreground">{text}</p>
        <ul className="mt-5 space-y-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-foreground/90">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <Button
          asChild
          variant={emphasis === "soft" ? "hero" : "outline"}
          size="lg"
          className="mt-6"
        >
          <Link to={ctaTo}>
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
