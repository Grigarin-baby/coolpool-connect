import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [{ title: "My trips — Coolpool" }, { name: "description", content: "View your bookings and upcoming rides." }],
  }),
  component: TripsPage,
});

function TripsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 max-w-5xl flex-1">
        <Card className="p-12 rounded-3xl text-center shadow-card border-border/60 bg-gradient-soft">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Ticket className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl font-bold">No trips yet</h1>
          <p className="mt-3 text-muted-foreground">Once you book a ride, it'll show up here.</p>
          <Button asChild variant="hero" className="mt-6 rounded-full">
            <Link to="/search">Find a ride</Link>
          </Button>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
