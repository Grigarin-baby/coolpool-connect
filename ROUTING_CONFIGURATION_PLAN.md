# Routing Configuration — Trip Creation Wizard

Mobile-first, three-screen wizard that drives the **routing portion** of trip
creation. It hands the remaining fields (vehicle, seats, total price) back to
the existing publish form. Supersedes the auto-geocode approach in
`SMART_ROUTE_SEGMENT_PLAN.md` — boarding points are now **fully manual**.

## Locked decisions

| Question | Answer |
| --- | --- |
| Boarding-point selection | **Fully manual** — host drops pins / searches places. No auto-seed. |
| Time picker | **Tap-on-clock-face** (analog). Hour ring → minute ring → AM/PM toggle. |
| Wizard scope | **Routing only.** After step 3, return to the existing form for vehicle/seats/price. |
| Platforms | **Mobile + desktop adaptive.** One screen at a time on both; desktop uses a centered modal, mobile is fullscreen. |

## Screen flow

### Step 1 — Route

Single full-height screen.

- **Top**: From + To inputs (existing Google Places autocomplete).
- **Middle**: map (Google Maps JS). When both endpoints are set, fire one
  `DirectionsService.route({ provideRouteAlternatives: true })`. Each
  alternative is drawn as a thin polyline; tapping one promotes it to thick +
  primary color. Tapping its card in the list does the same.
- **Below map**: a horizontal scroller of alternative cards. Each card shows
  distance, duration, the "via" hint Google returns (e.g. "via NH 44"). One is
  pre-selected (Google's first / fastest).
- **Footer**: Continue button. Disabled until both endpoints + one alternative
  are chosen. (When only one alternative comes back, it auto-selects silently
  and the scroller hides.)

### Step 2 — Date & Time

- **Date**: a row of **7 chip buttons** = the next 7 days starting today.
  - Chip 1 is labeled `Today` (with the date underneath).
  - Chip 2 is labeled `Tomorrow` (with the date underneath).
  - Chips 3–7 show the weekday name + date (`Mon · 16`, `Tue · 17`, …).
  - Selected chip uses the brand gradient pill style already in use on the
    landing search; default selection = `Today`.
  - No calendar fallback for now — picking a date more than 6 days out
    would need a "More dates" sheet, which is out of scope.
- **Time**: custom `ClockFacePicker` component.
  - Round face, hour numerals 1–12, large.
  - Two-stage tap: first tap selects the hour (snaps to nearest numeral); UI
    then switches to a minute ring (00, 05, 10, … in 5-min steps). Second tap
    sets the minute.
  - **AM/PM** pill toggle directly below.
  - Big read-out at the top of the card: `08 : 30 AM` in a 4xl font.
  - "Set minute manually" link for users who want a typed override.
- **Footer**: Back + Continue. Date defaults to Today, so Continue is only
  blocked until the host has set a time on the clock face.

### Step 3 — Boarding points (manual)

- **Top**: search input ("Add a stop — city, area, or landmark"). Google
  Places autocomplete restricted to bounds of the chosen route. Select →
  drops a pin.
- **Map**: shows the chosen route's polyline (decoded from step 1). Two
  ways to add a pin:
  1. Pick from search input (above).
  2. Long-press / tap a custom "Add" mode button → next map tap drops a pin
     at the exact lat/lng (label defaults to `Stop N`).
- **Pin projection**: every pin is auto-projected onto the polyline via the
  existing `closestVertexIndex` / `distanceAlongPolylineKm` helpers in
  `src/lib/geo.ts`. That gives each stop a `distanceFromOriginKm` for free,
  used both for ordering and downstream per-segment pricing.
- **Stops list** (below map): each row is `[handle] [label-editable] [km from
  start] [trash]`. Order is auto-derived from km-along-route, but a drag
  handle lets the host override if Google's polyline routes weirdly through
  their preferred stop.
- **Boarding-points are also drop-offs** — no separate UI for drop-offs; each
  intermediate stop is treated as `stopType: "both"` (already supported in
  `TripStop`).
- **Skip allowed**: zero stops is valid (direct trip).
- **Footer**: Back + "Done — continue to trip details" → closes the wizard and
  applies its data to the existing form.

## What the wizard returns to the existing form

Single `WizardResult` object:

```ts
interface WizardResult {
  from: { label: string; lat: number; lng: number };
  to: { label: string; lat: number; lng: number };
  departureAt: string; // ISO, combining date + clock-face time + dayjs.local
  polyline: string;          // chosen alternative's overview_polyline
  totalDistanceKm: number;   // chosen alternative's leg distance
  durationMin: number;       // for display only; not persisted today
  stops: Array<{
    label: string;
    lat: number;
    lng: number;
    distanceFromOriginKm: number;
    stopType: "both"; // pickup + drop
  }>;
}
```

The existing publish handler in `driver/dashboard.tsx` already writes
`fromLocation`, `toLocation`, `departureAt`, `polyline`, `totalDistanceKm` to
the `trips` collection and (currently) only origin + destination into
`trip_stops`. The change is: write the full intermediate-stop list as well,
each with its `distanceFromOriginKm` from projection. No schema change.

## Adaptive layout

- **Mobile (< 768px)**: each step is a fullscreen view. Header has back arrow
  + step label ("Route", "When", "Stops") + progress dots. Footer is a sticky
  Continue button.
- **Desktop (≥ 768px)**: centered modal at `max-w-2xl`, same three steps
  rendered one at a time. Map gets a fixed height (≈ 50vh) instead of
  growing.
- Both share the same `<Step*>` components; only the outer container differs.
  Implemented as `<TripWizard mode={isMobile ? "fullscreen" : "modal"} />`.

## File plan

New files under `src/components/trip-wizard/`:

| File | Role |
| --- | --- |
| `TripWizard.tsx` | Container. Holds `step` + `WizardData` state. Renders Step 1/2/3 + adaptive shell. |
| `StepRoute.tsx` | From/To inputs + map + alternatives card scroller. |
| `StepDateTime.tsx` | Date chip strip + `ClockFacePicker` + AM/PM toggle. |
| `StepStops.tsx` | Search + map with pin-drop + ordered stops list. |
| `ClockFacePicker.tsx` | Stand-alone analog clock. Two-stage hour/minute. |
| `RouteMap.tsx` | Wraps a Google Map; draws alternative polylines + selection state. |
| `StopsMap.tsx` | Map with chosen polyline + interactive pin placement / drag. |
| `types.ts` | `WizardData`, `WizardResult`, alternative shape. |
| `useWizardMaps.ts` | Lazy-loads `google.maps` once for the wizard tree (mirrors the loader patterns already in `TripSearch.tsx` / `RideRouteMap.tsx`). |

Modified:

| File | Change |
| --- | --- |
| `src/routes/driver/dashboard.tsx` | Replace From/To/Departure inputs in the publish form with a single "Plan route" button → opens `TripWizard`. On done, fill the existing form fields + a hidden `wizardStops` ref used by the create-trip handler when calling `createTrip` / `createTripStops`. |
| `src/data/appwrite-repository.ts` | Extend `createTrip` (or a sibling) to also write the wizard's intermediate stops to `trip_stops` with `distanceFromOriginKm` and `stopType: "both"`. The collection already supports it. |

## Cost

Per published trip:

| Call | SKU rate | Times per trip |
| --- | --- | --- |
| Directions API w/ `provideRouteAlternatives` | $0.010 | 1 |
| Geocoding (reverse) | $0.005 | **0** — boarding points are manual; Places autocomplete returns formatted_address with the pick |
| Places Autocomplete | session-billed | depends on host typing — already billed under existing usage |

So routing config adds **~$0.010 (~₹0.85) per published trip** on top of what
search/autocomplete already costs. Google's standing $200/month free credit
covers ~20,000 publishes/month before this line item leaves the free tier.

## Out of scope for this milestone

- Buyer-side segment search / segment pricing on the search card (will be
  picked up after this lands).
- Editing the route on an already-published trip (no in-place edit yet —
  delete + recreate).
- ETA per intermediate stop (would need per-leg duration; can compute later
  from `route.legs[i].duration` if we keep it around).
- Saving a draft if the host closes mid-wizard.

## Implementation order

1. **`ClockFacePicker`** in isolation (SVG-based, no dependencies). Unit test
   the angle-to-time math.
2. **`RouteMap`** + `StepRoute` — load Maps lazily, draw alternatives, select.
3. **`StepDateTime`** — wire ClockFacePicker into wizard state with the date
   chip strip.
4. **`StopsMap`** + `StepStops` — pin drop, projection, drag-reorder.
5. **`TripWizard`** shell + adaptive mobile/desktop layout.
6. Wire into `driver/dashboard.tsx` and extend `createTrip` to write the
   intermediate-stops list to `trip_stops`.

Each step is independently shippable behind a feature flag while we polish.
