# Smart Route — Host Route Selection + Segment-Aware Search

Implementation plan derived from `Smart Route Segment Pricing Plan.docx` and the
follow-up scoping conversation. The docx covers the full long-term vision
(dynamic midpoint boarding + distance-based pricing); **this document covers
only what we are building first**.

## Scope

Two objectives, in this order:

1. **Host route configuration.** When publishing a trip, if Google returns more
   than one driveable route between origin and destination, the host picks one.
   Each route's intermediate boarding points (the towns/cities Google would
   drive through) are extracted and stored against the trip.
2. **Segment-aware search.** When a passenger searches for a sub-segment of a
   published route (e.g. `Thrissur → Calicut` on a `Kochi → Calicut` trip), the
   trip appears in results, the card headline shows the matched segment, and
   the per-seat price is prorated to that segment's distance.

**Explicitly out of scope** for this iteration:

- Booking flow changes — the booking page still books the whole trip; making
  a segment booking only consume seats for `[fromIdx, toIdx)` and reserve
  per-segment seat-conflict slots is a follow-up.
- Polyline-proximity matching for unnamed off-route pickup points.
- ETA per intermediate stop (we use the trip's single `departureAt` for now).
- Backfilling old trips with stop data. Trips published before this lands
  continue to match exactly as they do today (string match on `fromLocation` /
  `toLocation` only).

## Current state of the codebase

- `driver/dashboard.tsx` publish flow calls `DirectionsService.route()` with
  origin + destination only — no `provideRouteAlternatives`, no waypoints.
  Around `dashboard.tsx:629–651` it stores **only 2 stops** (origin and
  destination) in `trip_stops`, even though the collection supports any
  number.
- `domain.ts:14` — `TripStop` already has `stopIndex`, `location`, `lat`, `lng`,
  `distanceFromOriginKm`, `stopType`. **The data model is ready**; only
  population is missing.
- `TripSearch.tsx:282–303` — search filters `listTrips` results on
  `trip.fromLocation` / `trip.toLocation` only. It never reads `trip_stops`.
- `RideRouteMap.tsx` renders the stored `polyline` already, so once the chosen
  alternative's polyline is saved, downstream rendering is unchanged.

## What will change

### 1. Publish flow — `src/routes/driver/dashboard.tsx`

- Change the Directions request to pass `provideRouteAlternatives: true`.
- For **each** returned alternative, derive the boarding-point list:
  1. Decode `route.overview_polyline` with `geometry.encoding.decodePath`.
  2. Walk the path and pick **exactly 5 sample points** at fixed fractions of
     cumulative distance — `1/6, 2/6, 3/6, 4/6, 5/6`. This is a hard cap
     regardless of route length, so long and short routes both stay within
     the same per-trip Google quota budget.
  3. Reverse-geocode each sample via `Geocoder.geocode({ location })`.
  4. Reduce each result to its `locality` (fallback:
     `administrative_area_level_2`).
  5. Dedupe consecutive duplicates; drop entries that match the trip origin or
     destination locality.
  6. Interpolate `distanceFromOriginKm` for each kept point from the cumulative
     leg distance.
- Add a **Choose route** step to the publish modal: one card per alternative
  showing a mini `RideRouteMap`, total distance + duration, and the detected
  city chain (`Kochi · Thrissur · Palakkad · Calicut`). One-alternative case
  auto-selects silently.
- On submit, the chosen alternative supplies `polyline`, `totalDistanceKm`,
  `pricePerKm`, and the full `stopsData` (origin + each detected boarding
  point + destination, all with correct `distanceFromOriginKm` and
  `stopType: "both"` for intermediates).

### Google Maps API cost (per published trip)

Hard-capped at **6 calls per trip** at publish time — nothing extra at search
time.

| Call                                            | SKU rate     | Per trip       |
| ----------------------------------------------- | ------------ | -------------- |
| Directions API (with `provideRouteAlternatives`)| $0.010 / req | 1 × $0.010     |
| Geocoding API (reverse-geocode)                 | $0.005 / req | 5 × $0.005     |
| **Total**                                       |              | **~$0.035 (~₹3)** |

Google's standing **$200/month free credit** applies across these SKUs, so
this feature alone covers roughly **5,700 trips/month for free**.

| Published trips / month | Net cost (after $200 credit)         |
| ----------------------- | ------------------------------------ |
| 1,000                   | $0                                   |
| 5,000                   | $0                                   |
| 10,000                  | ~$150 (~₹12,750)                     |
| 50,000                  | ~$1,550 (~₹1.3 L)                    |

Caveats: the $200 credit is shared with Map JS loads, Places autocomplete,
and the search-time geocoder validation already in use — real headroom is
smaller than the table implies. Google adjusts SKU pricing periodically;
the table is accurate to within ~20% over a 12-month horizon.

### 2. Storage — Appwrite schema additions

Two new attributes on `trips`; both are caches that let search stay a single
round-trip without fetching `trip_stops` per result.

| Attribute        | Type   | Max  | Example                                          |
| ---------------- | ------ | ---- | ------------------------------------------------ |
| `stop_names_csv` | string | 1000 | `kochi,thrissur,palakkad,coimbatore,kozhikode`   |
| `stop_km_csv`    | string | 500  | `0,75,140,205,260`                               |

Both lists are aligned by index and ordered along the route. Names are
lowercased primary-segment only.

Migration is added to `scripts/appwrite-migrate.mjs`. No existing column is
modified.

### 3. Repository — `src/data/appwrite-repository.ts`

- `createTrip` accepts `stopNamesCsv` + `stopKmCsv` and writes them.
- `listTrips` mapper exposes both fields on the returned `Trip`.
- `Trip` interface in `src/lib/domain.ts` gets `stopNamesCsv: string` and
  `stopKmCsv: string` (both default to `""` for legacy docs).

### 4. Segment matcher — `src/lib/geo.ts`

New helper:

```ts
findSegmentMatch(
  stopNamesCsv: string,
  fromQuery: string,
  toQuery: string,
): { fromIdx: number; toIdx: number } | null
```

- Tokenize the csv, fuzzy-compare each token to the queries using the existing
  `routeCitySegmentsMatch`.
- Return the first `(fromIdx, toIdx)` pair with `fromIdx < toIdx`.
- Return `null` if either query has no match, or if `toIdx <= fromIdx`.

### 5. Search — `src/components/TripSearch.tsx`

- Replace the `fromOk && toOk` predicate in `onSearch` with the segment
  matcher. Fall back to the existing substring match when `stopNamesCsv` is
  empty (legacy trips).
- Pass `matchedFromIdx` / `matchedToIdx` alongside each result.
- Result card headline:
  - If `matchedFromIdx === 0 && matchedToIdx === stops.length - 1` → render as
    today (full route).
  - Otherwise → headline shows `stops[fromIdx] → stops[toIdx]`, with a small
    subline `part of <trip.fromLocation> → <trip.toLocation>`.
- Per-seat price on the card uses the formula below.

### 6. Pricing on the result card

Per the user's spec, prorated based on the matched segment:

```
perSeatFullTrip = trip.totalPrice / trip.totalSeats
perSeatPerKm    = perSeatFullTrip / trip.totalDistanceKm
segmentKm       = stopKm[toIdx] - stopKm[fromIdx]
perSeatSegment  = round(perSeatPerKm * segmentKm)
```

- Shown as the card's primary price when a sub-segment matched.
- Full-trip search (`fromIdx === 0 && toIdx === last`) keeps showing
  `perSeatFullTrip` unchanged.
- One open ambiguity in the user's wording (*"km from the search point to the
  end of the trip"*) — we implement `segmentKm = stopKm[toIdx] -
  stopKm[fromIdx]` (search-point → search-end) which matches the docx's
  `(segment / total) × price` formula. If "end of trip" was meant literally
  (search-point → trip's final destination), it is a one-line change to swap
  `toIdx` for `last`.

The booking flow is unchanged; whatever the booking page charges today is
still what gets billed. The card price is informational until the booking
flow is updated in the phase-2 work.

## File-level change list

| File                                                    | Change                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/routes/driver/dashboard.tsx`                       | Alternatives in Directions; reverse-geocode sampler; "Choose route" step; full stopsData.  |
| `src/integrations/appwrite/schema.ts`                   | No change (collection ids unchanged); doc comment about new attrs.                         |
| `scripts/appwrite-migrate.mjs`                          | Add `stop_names_csv` and `stop_km_csv` attributes on the `trips` collection.               |
| `src/data/appwrite-repository.ts`                       | Read/write the two new attributes in `createTrip` and `listTrips`.                         |
| `src/lib/domain.ts`                                     | `Trip.stopNamesCsv` and `Trip.stopKmCsv`.                                                  |
| `src/lib/geo.ts`                                        | New `findSegmentMatch` helper; small sampler util for reverse-geocode spacing.             |
| `src/components/TripSearch.tsx`                         | Segment-aware filter; matched-segment headline; prorated per-seat price.                   |

## Implementation order

1. Schema migration + repository plumbing (no UI change yet).
2. Reverse-geocode sampler + multi-route publish UI.
3. `findSegmentMatch` helper + unit tests.
4. Search predicate + result-card headline.
5. Prorated price on the card.

Each step is independently shippable behind the empty-csv fallback (legacy
trips just keep working).

## Phase 2 (next, after this lands)

- Booking flow honors segments: a segment booking only reserves seats on
  `[fromIdx, toIdx)`; the seat-reservation model gets a `from_stop_index` /
  `to_stop_index` pair so two passengers can share a seat on disjoint
  segments. Minimum fare floor, configurable per pricing rule.
- Per-stop ETA on the result card (computed from `route.legs[i].duration`).
- Host dashboard: live view of which segment each booked passenger occupies.
