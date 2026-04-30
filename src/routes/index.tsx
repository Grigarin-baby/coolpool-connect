import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Calendar, Users, Sparkles, ShieldCheck, Zap, Heart, Star } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coolpool — Share the road, split the cost" },
      { name: "description", content: "Find or host intercity rides with smart per-kilometer pricing. Book a single seat or the whole car." },
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
        <div className="container mx-auto px-4 pt-16 pb-24 md:pt-24 md:pb-32 max-w-7xl relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-card/70 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-muted-foreground border border-border/60 shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Smart pricing. Real travelers. Zero markup games.
            </div>
            <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              Share the road,
              <br />
              <span className="text-gradient-primary">split the cost.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
              Coolpool connects intercity travelers with hosts driving the same route.
              Book any segment, pay only for the kilometers you ride.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/search">
                  Find a ride <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="soft" size="xl">
                <Link to="/host">Host a ride</Link>
              </Button>
            </div>
          </div>

          {/* QUICK SEARCH CARD */}
          <Card className="mt-12 md:mt-16 p-2 md:p-3 rounded-3xl shadow-elevated border-border/60 bg-card/95 backdrop-blur-xl max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 md:gap-1">
              <QuickField icon={<MapPin className="h-4 w-4" />} label="From" value="Where from?" />
              <QuickField icon={<MapPin className="h-4 w-4" />} label="To" value="Where to?" />
              <QuickField icon={<Calendar className="h-4 w-4" />} label="When" value="Pick a date" />
              <Button asChild variant="hero" size="lg" className="md:rounded-2xl">
                <Link to="/search">
                  Search <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container mx-auto px-4 py-20 md:py-28 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">How it works</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">A smarter way to travel together</h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <MapPin className="h-6 w-6" />,
              title: "Search your route",
              text: "Tell us where you're going and when. We match you with hosts driving past your pickup and drop points.",
            },
            {
              icon: <Users className="h-6 w-6" />,
              title: "Book just the seats you need",
              text: "Reserve one seat or the whole back row. Pricing is per-kilometer, calculated dynamically.",
            },
            {
              icon: <Heart className="h-6 w-6" />,
              title: "Ride and rate",
              text: "Meet your host, enjoy the ride, and rate your experience to keep the community trustworthy.",
            },
          ].map((step, i) => (
            <Card key={i} className="p-8 rounded-3xl border-border/60 shadow-card hover:shadow-elevated transition-base group">
              <div className="h-12 w-12 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow group-hover:scale-110 transition-base">
                {step.icon}
              </div>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* DUAL CTA */}
      <section className="container mx-auto px-4 pb-20 md:pb-28 max-w-7xl">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-10 rounded-3xl border-border/60 bg-gradient-soft overflow-hidden relative">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
            <Zap className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-3xl font-bold">For travelers</h3>
            <p className="mt-3 text-muted-foreground">Cheaper than a bus, comfier than a cab. Pay only for the kilometers you actually ride.</p>
            <Button asChild variant="hero" size="lg" className="mt-6">
              <Link to="/search">Find a ride <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </Card>

          <Card className="p-10 rounded-3xl border-border/60 bg-card overflow-hidden relative">
            <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-primary-glow opacity-20 blur-3xl" />
            <ShieldCheck className="h-10 w-10 text-primary" />
            <h3 className="mt-4 text-3xl font-bold">For hosts</h3>
            <p className="mt-3 text-muted-foreground">Already driving? Add stops along your route, set a fair total price, and let Coolpool fill your empty seats.</p>
            <Button asChild variant="default" size="lg" className="mt-6 rounded-full">
              <Link to="/host">Host a ride <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="container mx-auto px-4 pb-24 max-w-7xl">
        <Card className="p-10 md:p-14 rounded-[2rem] bg-gradient-primary text-primary-foreground shadow-elevated overflow-hidden relative border-0">
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

      <SiteFooter />
    </div>
  );
}

function QuickField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-secondary/60 transition-base cursor-pointer">
      <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
