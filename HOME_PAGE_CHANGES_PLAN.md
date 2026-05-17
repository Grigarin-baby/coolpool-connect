# Home Page Changes — Implementation Plan

Scope: three home-page changes. Decisions below reflect the clarifying answers received.

Architecture note: this app has **no custom server and no Appwrite Functions infra** — it talks to Appwrite (BaaS) directly from the browser via `src/data/appwrite-repository.ts`. Appwrite's query API cannot do server-side `GROUP BY`/aggregation. So the "dedicated endpoint" for trending routes is implemented as a **dedicated Appwrite-backed repository function** (`listTrendingRoutes`) that uses Appwrite `Query` for the server-side filtering it _can_ do (status, date) and performs the grouping/counting in code. This is the only feasible "configure in Appwrite" option without introducing new deployment infrastructure.

---

## 1) Swap arrow between Pickup and Destination

**File:** `src/components/TripSearch.tsx`

Add a swap handler in `TripSearchForm`:

```ts
const swapLocations = () => {
  const { from, to } = form.getFieldsValue(["from", "to"]);
  form.setFieldsValue({ from: to, to: from });
};
```

Add a clickable swap control in all three layouts (it currently has none / only a static arrow):

- **`page` variant** (~line 532): replace the static `<ArrowRight>` between the From/To `Form.Item`s with a circular `<button type="button">` using a horizontal swap icon (`ArrowLeftRight`).
- **Desktop landing** (~lines 576–630): insert a circular swap button centered on the divider between the Pickup and Destination rows (absolutely positioned over the `divide-y` line), vertical swap icon (`ArrowUpDown`).
- **Mobile landing** (~lines 708–712): replace the existing static "Route arrow connector" with the same circular swap button (`ArrowUpDown`).

Details:
- `type="button"` so it never submits the form.
- `aria-label="Swap pickup and destination"`.
- Styling consistent with the card: white background, subtle border, primary color on hover, small rounded-full button.
- Only form field values are swapped (not the autocomplete option lists — they refresh on next keystroke/search). Keeps scope tight.

---

## 2) Red theme for the "no result found" area

**File:** `src/components/TripSearch.tsx` — `TripSearchResults`, the `results.length === 0` block (~lines 837–841).

Currently a neutral dashed card with antd `<Empty>`. Change to a red/destructive theme using the design-system semantic `destructive` token (on-brand red `oklch(0.62 0.23 25)`), not raw Tailwind red:

- Card: `border-destructive/30 bg-destructive/5` (light red tint, red border), drop `border-dashed` or keep — will keep a soft dashed red border.
- Replace the grey antd `<Empty>` graphic with a red icon (`SearchX` / `MapPinOff` from lucide), a red heading, and a muted-red description.
- Message text unchanged in meaning ("No trips match this route yet…").

Only the trip-search empty state is themed red (the trending section keeps its own existing empty state, since per task 3 it falls back to showing trips and rarely renders empty).

---

## 3) Trending routes — dedicated Appwrite-backed function

### New repository function

**File:** `src/data/appwrite-repository.ts` — add `listTrendingRoutes()`.

Server-side (Appwrite `Query`) filtering:
- `Query.equal("status", ["scheduled", "in_progress"])` — only valid/active trips (excludes `cancelled` and `completed`).
- `Query.greaterThanEqual("departure_at", startOfTodayISO)` — excludes trips whose departure **calendar date is before today** (a trip later today still shows). `startOfTodayISO = dayjs().startOf("day").toISOString()`.
- `Query.limit(200)` — enough to compute trending reliably.

In-code logic:
1. **City filter (City-filtered + ranked):** keep the current behavior — when a city is known, keep only trips where `fromLocation` or `toLocation` matches the city via `routeCitySegmentsMatch` (same approach as today's `SERVICE_CITY` filter). When no city, operate globally.
2. **Normalize a route key:** `` `${primarySegment(from)}->${primarySegment(to)}` `` (first comma segment, trimmed, lowercased) so e.g. all "Calicut → Kochi" trips group together.
3. **Group & count** trips by route key.
4. **Trending:** routes with **count > 1**, sorted by count desc (tiebreak: earliest upcoming departure). Take **top 4 routes**. Representative trip per route = the **earliest upcoming** trip in that group.
5. **Fallback:** if **no** route has count > 1, return the **3 earliest-created** trips (`$createdAt` ascending) from the same valid/filtered set.
6. Return `Trip[]` (representative trips). UI intentionally keeps showing **less info** (no occurrence count badge), per request.

Appwrite note: queries on `status` + `departure_at` already used elsewhere (`listActiveTrips`, `listTrips`), so existing collection indexes cover this; no schema migration required for correctness. A composite index on `(status, departure_at)` is a nice-to-have for performance and can optionally be added to `scripts/appwrite-migrate.mjs`.

### UI wiring

**File:** `src/components/DynamicTrendingRoutes.tsx`

- Replace the inline `listTrips(100)` + manual filtering in **both** `fetchCityAndTrips` and `fetchFallbackCityAndTrips` with a single call to `listTrendingRoutes({ city })`.
- Keep the geolocation + "Trips from `<city>`" heading and the existing loading / success / error / empty states.
- Keep the existing compact card UI **unchanged** ("keep it that way").

---

## Edge cases & assumptions

- "Expired" = departure calendar date before today (local start-of-day → ISO). Possible timezone skew vs. server UTC is acceptable for a trending widget.
- `completed` trips are treated as not valid for trending (status whitelist `scheduled`/`in_progress`).
- Routes are de-duplicated so the same route appears once; the card links to that route's earliest upcoming trip.
- If fewer than 4 trending routes exist but at least one route repeats, show however many qualify (≤4); the 3-earliest fallback only triggers when **no** route repeats.

## Out of scope

- No backend/deployment infra added (no Appwrite Function service).
- No changes to trending card visual design.
- Autocomplete option lists are not swapped (only field values).

## Files touched

| File | Change |
|---|---|
| `src/components/TripSearch.tsx` | Swap button (3 layouts) + red no-result area |
| `src/data/appwrite-repository.ts` | New `listTrendingRoutes()` function |
| `src/components/DynamicTrendingRoutes.tsx` | Use `listTrendingRoutes()`; keep UI/geolocation |
| `scripts/appwrite-migrate.mjs` | _(optional)_ composite index `(status, departure_at)` |
