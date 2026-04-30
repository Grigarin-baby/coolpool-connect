import { createFileRoute } from "@tanstack/react-router";
import { Search, Car, MapPin, CreditCard } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Coolpool works" },
      { name: "description", content: "Coolpool matches travelers with hosts driving the same route. Smart per-kilometer pricing means you pay only for what you ride." },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  { icon: <Search className="h-6 w-6" />, title: "Search", text: "Enter where you're going and when. We match you with hosts driving past your pickup and drop." },
  { icon: <MapPin className="h-6 w-6" />, title: "Pick a stop", text: "Choose any segment of the host's route. Your distance, your price." },
  { icon: <Car className="h-6 w-6" />, title: "Ride", text: "Meet your host, enjoy the trip, and arrive ready." },
  { icon: <CreditCard className="h-6 w-6" />, title: "Fair pricing", text: "Total trip price ÷ total distance = price per km. You pay only for your segment." },
];

function HowItWorks() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 max-w-5xl flex-1">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">How it works</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">Smart pricing, no surprises</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Hosts set one total price for the whole trip. We split it fairly across every kilometer so travelers only pay for the part they ride.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {steps.map((s, i) => (
            <Card key={i} className="p-8 rounded-3xl shadow-card border-border/60">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow shrink-0">
                  {s.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider">Step {i + 1}</div>
                  <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-muted-foreground">{s.text}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-10 p-10 rounded-3xl bg-gradient-soft border-border/60">
          <h2 className="text-2xl font-bold">The pricing formula</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="bg-card rounded-2xl p-6 shadow-soft">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 1</div>
              <p className="mt-2 font-mono text-sm">price_per_km = total_price ÷ total_distance</p>
            </div>
            <div className="bg-card rounded-2xl p-6 shadow-soft">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 2</div>
              <p className="mt-2 font-mono text-sm">segment_price = (km_to − km_from) × price_per_km</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            If a host updates the total price, only new bookings use the new rate. Existing bookings stay locked in.
          </p>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
