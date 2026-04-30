import { createFileRoute, Link } from "@tanstack/react-router";
import { Construction, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Find a ride — Coolpool" },
      { name: "description", content: "Search available rides between cities. Filter by date, seats, and route." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 max-w-7xl flex-1">
        <Card className="p-12 rounded-3xl text-center shadow-card border-border/60 bg-gradient-soft">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Construction className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl font-bold">Search is coming next</h1>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            We're wiring up Google Maps autocomplete and route matching so you can find rides that pass through your pickup and drop points.
          </p>
          <Button asChild variant="soft" className="mt-6 rounded-full">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Back home</Link>
          </Button>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
