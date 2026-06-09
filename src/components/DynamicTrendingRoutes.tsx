import { TrendingUp, ArrowRight } from "lucide-react";
import dayjs from "dayjs";

const TRENDING_ROUTES: { from: string; to: string }[] = [
  { from: "Bengaluru", to: "Hyderabad" },
  { from: "Bengaluru", to: "Chennai" },
  { from: "Bengaluru", to: "Mysore" },
  { from: "Bengaluru", to: "Ananthapur" },
];

export function DynamicTrendingRoutes() {
  const triggerSearch = (from: string, to: string) => {
    window.dispatchEvent(
      new CustomEvent("coolpool:setSearch", {
        detail: { from, to, date: dayjs() },
      }),
    );
  };

  return (
    <section className="container mx-auto px-4 sm:px-5 py-10 sm:py-16 max-w-7xl">
      <div className="flex items-end justify-between mb-5">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">
          Trending <span className="text-primary">Routes</span>
        </h2>
        <TrendingUp className="h-5 w-5 text-primary/40" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {TRENDING_ROUTES.map((route, i) => (
          <button
            key={`${route.from}-${route.to}`}
            type="button"
            onClick={() => triggerSearch(route.from, route.to)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group relative isolate overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          >
            {/* glow accent */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            {/* top row: Today pill + chevron */}
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Today
              </span>
              <ArrowRight className="h-4 w-4 text-gray-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
            </div>

            {/* route — natural-width side-by-side, centered around the arrow.
                When the row can't fit on one line, the destination wraps to
                the next line (card grows taller). Within each name,
                break-words lets a single long word break instead of
                overflowing the card. */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span className="max-w-full text-3xl font-black leading-tight tracking-tight text-gray-900 break-words">
                {route.from}
              </span>
              <ArrowRight className="h-7 w-7 shrink-0 text-primary" strokeWidth={3} />
              <span className="trending-to-text max-w-full text-3xl font-black leading-tight tracking-tight break-words text-gradient-primary">
                {route.to}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
