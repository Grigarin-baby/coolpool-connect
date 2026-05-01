import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  MapPin,
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
import { TripSearchProvider, TripSearchForm, TripSearchResults } from "@/components/TripSearch";
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
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <SiteHeader />

      {/* HERO + TRIP SEARCH */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 bg-gradient-mesh opacity-80 pointer-events-none" />
        <div className="absolute top-0 right-0 h-[12rem] w-[12rem] sm:h-[18rem] sm:w-[18rem] rounded-none bg-primary-glow/30 blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4 sm:translate-x-0 sm:translate-y-0" />
        <div className="container mx-auto px-4 sm:px-5 pt-12 pb-16 sm:pt-16 sm:pb-20 md:pt-24 md:pb-24 lg:pt-28 lg:pb-28 max-w-7xl relative">
          <TripSearchProvider>
            <div className="grid items-start gap-10 sm:gap-12 lg:gap-14 xl:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(320px,500px)]">
              <div className="max-w-[52rem] min-w-0">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-none bg-card/70 backdrop-blur-md px-4 py-2 sm:px-5 text-xs sm:text-sm font-medium text-muted-foreground border border-border/60 shadow-soft max-w-full">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-balance leading-snug">
                    Built for intercity rides with dynamic pricing
                  </span>
                </div>
                <h1 className="mt-6 sm:mt-8 text-[2.8rem] sm:text-6xl md:text-[4.25rem] lg:text-[5rem] font-bold tracking-tight leading-[1.03] sm:leading-[1.01] font-heading">
                  Share the road,
                  <br />
                  <span className="text-gradient-primary">split the fun.</span>
                </h1>
                <p className="mt-6 sm:mt-8 text-lg sm:text-xl md:text-[1.4rem] text-muted-foreground max-w-3xl text-pretty leading-relaxed">
                  Coolpool connects Ride Hosts and Travelers on the same intercity route. Book only
                  your segment, pay only for your distance, and travel with verified profiles.
                </p>
                <div className="mt-7 sm:mt-9 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                  <TrustPill icon={<RouteIcon className="h-5 w-5" />} text="Route-based matching" />
                  <TrustPill icon={<Wallet className="h-5 w-5" />} text="Fair pricing" />
                </div>
                <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-5">
                  <Button
                    asChild
                    variant="hero"
                    size="xl"
                    className="w-full sm:w-auto rounded-none justify-center min-h-14 px-8 sm:px-11 text-base sm:text-[1.05rem] [&_svg]:size-5"
                  >
                    <Link to="/host">
                      Host a ride <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="w-full min-w-0 lg:justify-self-end lg:max-w-none">
                <TripSearchForm variant="landing" id="find-a-ride" />
              </div>
            </div>

            <div className="mt-10 sm:mt-12 lg:mt-16 w-full min-w-0">
              <TripSearchResults variant="landing" />
            </div>
          </TripSearchProvider>
        </div>
      </section>

      {/* PROOF STRIP */}
      <section className="container mx-auto px-4 sm:px-5 py-8 md:py-10 max-w-7xl">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { value: "3-5 km", label: "route match tolerance" },
            { value: "Per segment", label: "seat conflict handling" },
            { value: "Dynamic", label: "price recalculation for new bookings" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-none border border-border/60 bg-card/70 px-4 py-4 text-center shadow-soft"
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
      <section className="container mx-auto px-4 sm:px-5 py-12 sm:py-16 md:py-24 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto px-1">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">
            How it works
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance">
            A smarter way to travel together
          </h2>
        </div>

        <div className="mt-10 sm:mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
          {[
            {
              icon: <MapPin className="h-6 w-6" />,
              title: "Search your route",
              text: "Choose pickup, drop, date, and seats. We show rides passing close to both points on route.",
            },
            {
              icon: <Users className="h-6 w-6" />,
              title: "Book just the seats you need",
              text: "Pick your segment and seats. Price is calculated from route distance and host's current rate.",
            },
            {
              icon: <Heart className="h-6 w-6" />,
              title: "Ride and rate",
              text: "Track upcoming trips, meet at pickup points, and rate hosts to keep the network reliable.",
            },
          ].map((step, i) => (
            <Card
              key={i}
              className="p-6 sm:p-8 rounded-none border-border/60 shadow-card hover:shadow-elevated transition-base group"
            >
              <div className="h-12 w-12 rounded-none bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow group-hover:scale-105 transition-base">
                {step.icon}
              </div>
              <h3 className="mt-5 text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* VALUE FOR BOTH ROLES */}
      <section className="container mx-auto px-4 sm:px-5 pb-12 sm:pb-16 md:pb-20 max-w-7xl">
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
            ctaHref="/#find-a-ride"
            ctaLabel="Find a ride"
            emphasis="soft"
          />
          <RoleCard
            icon={<Zap className="h-10 w-10 text-primary" />}
            title="For Ride Hosts"
            text="Post your trip once, add intermediate stops, and fill spare seats without manual pricing calculations."
            bullets={[
              "Set total trip price, system derives ",
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
      <section className="container mx-auto px-4 sm:px-5 pb-12 sm:pb-16 md:pb-20 max-w-7xl">
        <Card className="p-6 sm:p-10 md:p-14 rounded-none bg-gradient-primary text-primary-foreground shadow-elevated overflow-hidden relative border-0">
          <div className="absolute inset-0 bg-gradient-mesh opacity-30 mix-blend-overlay pointer-events-none" />
          <div className="relative grid gap-6 sm:gap-8 md:grid-cols-3 text-center">
            {[
              { stat: "₹3.50", label: "Average per km" },
              { stat: "4.9★", label: "Host rating" },
              { stat: "60%", label: "Cheaper than cabs" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">{s.stat}</div>
                <div className="mt-2 text-primary-foreground/80">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 sm:px-5 pb-16 sm:pb-24 max-w-7xl">
        <Card className="rounded-none border-border/60 p-6 sm:p-8 md:p-12 bg-card shadow-card">
          <div className="max-w-3xl min-w-0">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-balance">
              Plan your next intercity ride in under a minute.
            </h3>
            <p className="mt-3 text-muted-foreground">
              Search active rides or create your own route. Coolpool handles distance-aware pricing
              and segment seat logic.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Button asChild variant="hero" size="lg" className="rounded-none w-full sm:w-auto justify-center">
                <a href="#find-a-ride">
                  Start with search <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-none w-full sm:w-auto justify-center">
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

function TrustPill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-none border border-border/60 bg-card/70 px-3 py-2 sm:px-4 sm:py-2.5 text-sm shadow-soft">
      <span className="text-primary shrink-0">{icon}</span>
      <span className="text-foreground/90 text-balance leading-snug">{text}</span>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  text,
  bullets,
  ctaTo,
  ctaHref,
  ctaLabel,
  emphasis,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  bullets: string[];
  ctaTo?: "/host";
  ctaHref?: string;
  ctaLabel: string;
  emphasis: "soft" | "default";
}) {
  return (
    <Card
      className={`p-6 sm:p-8 md:p-10 rounded-none border-border/60 overflow-hidden relative min-w-0 ${
        emphasis === "soft" ? "bg-gradient-soft" : "bg-card"
      }`}
    >
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-none bg-primary-glow/20 blur-3xl pointer-events-none" />
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
          className="mt-6 w-full sm:w-auto justify-center rounded-none"
        >
          {ctaHref ? (
            <a href={ctaHref}>
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <Link to={ctaTo!}>
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </Button>
      </div>
    </Card>
  );
}

