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
  Lock,
  Star,
  Info,
  Car,
  Plane,
  Bus,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TripSearchProvider, TripSearchForm, TripSearchResults } from "@/components/TripSearch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

      {/* SAFETY & TRUST */}
      <section className="bg-secondary/30 border-y border-border/60 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-5 max-w-7xl">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-green-600">
                <ShieldCheck className="h-4 w-4" />
                Verified Safety
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                Your safety is our <span className="text-primary">priority</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We've built trust into every kilometer. From identity verification to real-time trip monitoring, we ensure every ride is secure.
              </p>
              <div className="grid sm:grid-cols-2 gap-6 pt-4">
                {[
                  { icon: <Lock className="text-primary" />, title: "ID Verification", text: "Every host and traveler is verified before their first ride." },
                  { icon: <ShieldCheck className="text-primary" />, title: "Trip Tracking", text: "Share your live location with friends and family." },
                  { icon: <Users className="text-primary" />, title: "Community Ratings", text: "Transparent reviews keep our community high-quality." },
                  { icon: <Zap className="text-primary" />, title: "Instant Support", text: "24/7 assistance for any issues during your journey." },
                ].map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-card flex items-center justify-center shadow-soft border border-border/40">
                      {item.icon}
                    </div>
                    <h4 className="font-bold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
              <Card className="relative p-2 rounded-3xl border-border/40 shadow-elevated bg-card/80 backdrop-blur-xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=1000" 
                  alt="Safe driving" 
                  className="rounded-2xl object-cover aspect-[4/3]"
                />
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="container mx-auto px-4 sm:px-5 py-16 sm:py-24 max-w-7xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Why choose <span className="text-primary">Coolpool?</span></h2>
          <p className="mt-4 text-muted-foreground text-lg">Compare us with your usual travel options.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { 
              title: "Public Bus", 
              icon: <Bus className="h-8 w-8" />, 
              pros: ["Cheap"], 
              cons: ["Rigid timing", "Crowded", "Fixed stops"],
              status: "Frustrating"
            },
            { 
              title: "Coolpool", 
              icon: <Car className="h-8 w-8 text-primary" />, 
              pros: ["Flexible timing", "Door-to-door segment", "Comfortable", "Meet new people"], 
              cons: ["Dependent on hosts"],
              status: "Premium",
              highlight: true
            },
            { 
              title: "Private Taxi", 
              icon: <Plane className="h-8 w-8" />, 
              pros: ["Private", "Fast"], 
              cons: ["Very expensive", "Single person cost"],
              status: "Costly"
            }
          ].map((item, i) => (
            <Card key={i} className={cn(
              "p-8 border-border/60 rounded-none relative overflow-hidden transition-all duration-300",
              item.highlight ? "border-primary shadow-glow bg-primary/[0.02] scale-105 z-10" : "bg-card/50"
            )}>
              {item.highlight && <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold uppercase tracking-widest">Recommended</div>}
              <div className="mb-6">{item.icon}</div>
              <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase text-green-600 mb-2 tracking-widest">The Good</p>
                  <ul className="space-y-2">
                    {item.pros.map((p, j) => <li key={j} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> {p}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-red-500 mb-2 tracking-widest">The Bad</p>
                  <ul className="space-y-2">
                    {item.cons.map((c, j) => <li key={j} className="flex items-center gap-2 text-sm opacity-60"><Info className="h-4 w-4" /> {c}</li>)}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-primary/5 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-5 max-w-7xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Trusted by <span className="text-primary">thousands</span></h2>
            <p className="mt-4 text-muted-foreground text-lg">Real stories from our intercity travelers.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: "Rahul S.", role: "Regular Traveler", text: "The segment booking is a lifesaver. I saved 50% on my commute from Bengaluru to Tumakuru compared to a cab.", rating: 5 },
              { name: "Ananya M.", role: "Host", text: "Hosting on Coolpool has helped me cover my fuel costs and I've met some amazing people on my weekend trips home.", rating: 5 },
              { name: "Vikram K.", role: "Tech Professional", text: "Clean, reliable, and way more comfortable than the bus. The app is super intuitive to use.", rating: 4 },
            ].map((t, i) => (
              <Card key={i} className="p-8 border-border/40 rounded-none bg-card shadow-soft">
                <div className="flex gap-1 mb-4">
                  {[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                <p className="italic text-lg mb-6 leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{t.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="container mx-auto px-4 sm:px-5 py-16 sm:py-24 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">Frequently Asked <span className="text-primary">Questions</span></h2>
          <p className="mt-4 text-muted-foreground">Everything you need to know about Coolpool.</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: "How is the price calculated?", a: "Prices are calculated based on the distance of your specific segment (pickup to drop) and the host's per-kilometer rate." },
            { q: "Is it safe to travel with strangers?", a: "Yes, we verify all users via official IDs. Our rating system ensures high community standards, and you can share your live trip status." },
            { q: "Can I cancel my booking?", a: "Yes, you can cancel up to 2 hours before the trip for a full refund. Cancellations closer to the trip time may incur a small fee." },
            { q: "What if the host cancels?", a: "If a host cancels, you receive a 100% refund immediately, and we notify you of alternative rides on the same route." },
          ].map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
              <AccordionTrigger className="text-left font-bold text-lg hover:text-primary transition-colors">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 sm:px-5 pb-16 sm:pb-24 max-w-7xl">
        <Card className="rounded-none border-0 p-8 sm:p-12 md:p-20 bg-gradient-hero relative overflow-hidden text-center shadow-glow">
          <div className="absolute inset-0 bg-gradient-mesh opacity-20 pointer-events-none" />
          <div className="relative max-w-3xl mx-auto space-y-8">
            <h3 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-balance leading-tight">
              Ready to <span className="text-gradient-primary">start your journey?</span>
            </h3>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
              Join thousands of people saving money and making new friends on the road.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="hero" size="xl" className="rounded-none px-12 h-14 text-lg">
                <a href="#find-a-ride">Find a Ride <ArrowRight /></a>
              </Button>
              <Button asChild variant="outline" size="xl" className="rounded-none px-12 h-14 text-lg bg-card/50 backdrop-blur-sm">
                <Link to="/host">Become a Host</Link>
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

