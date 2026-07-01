import { TrendingUp, ArrowRight, ArrowDown } from "lucide-react";

const TRENDING_ROUTES: { from: string; to: string }[] = [
  { from: "Bengaluru", to: "Hyderabad" },
  { from: "Bengaluru", to: "Chennai" },
  { from: "Bengaluru", to: "Mysore" },
  { from: "Bengaluru", to: "Ananthapur" },
  { from: "Bengaluru", to: "Kurnool" },
  { from: "Bengaluru", to: "Tirupati" },
  { from: "Anantapur", to: "Kurnool" },
  { from: "Anantapur", to: "Hyderabad" },
];

export function DynamicTrendingRoutes() {
  const triggerSearch = (from: string, to: string) => {
    // No date — search all upcoming trips on this route (a near-future ride
    // past midnight shouldn't be hidden by a single-day "Today" filter).
    window.dispatchEvent(
      new CustomEvent("coolpool:setSearch", {
        detail: { from, to },
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TRENDING_ROUTES.map((route, i) => (
          <button
            key={`${route.from}-${route.to}`}
            type="button"
            onClick={() => triggerSearch(route.from, route.to)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group relative isolate overflow-hidden rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          >
            {/* glow accent */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            {/* top row: Popular pill + chevron */}
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Popular
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
            </div>

            {/* Mobile: stack from ↓ to vertically so long names never wrap.
                Desktop (sm+): side-by-side with → arrow. */}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
              <span className="text-lg sm:text-2xl lg:text-3xl font-black leading-tight tracking-tight text-gray-900 truncate">
                {route.from}
              </span>
              <ArrowDown className="h-4 w-4 shrink-0 text-primary sm:hidden" strokeWidth={3} />
              <ArrowRight className="hidden sm:block h-5 w-5 lg:h-7 lg:w-7 shrink-0 text-primary" strokeWidth={3} />
              <span className="text-lg sm:text-2xl lg:text-3xl font-black leading-tight tracking-tight truncate text-gradient-primary">
                {route.to}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
