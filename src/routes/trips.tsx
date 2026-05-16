import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { listTravelerBookings } from "@/data/appwrite-repository";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "My trips — Coolpool" },
      { name: "description", content: "View your bookings and upcoming rides." },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) {
        if (active) setCount(0);
        return;
      }
      try {
        const bookings = await listTravelerBookings(user.$id);
        if (active) setCount(bookings.length);
      } catch {
        if (active) setCount(null);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const subtitle =
    count === null
      ? "Connect Appwrite booking collections to show your trip history."
      : count > 0
        ? `You have ${count} booking${count > 1 ? "s" : ""}. Full list UI is next.`
        : "Once you book a ride, it'll show up here.";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 max-w-5xl flex-1">
        <Card className="p-12 rounded-3xl text-center shadow-card border-border/60 bg-gradient-soft">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Ticket className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl font-bold">No trips yet</h1>
          <p className="mt-3 text-muted-foreground">{subtitle}</p>
          <Button asChild variant="hero" className="mt-6 rounded-3xl">
            <a href="/#find-a-ride">Find a ride</a>
          </Button>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
