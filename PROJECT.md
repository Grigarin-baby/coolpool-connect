# CoolPool Connect

An intercity carpooling marketplace connecting travelers with private drivers for city-to-city rides in Kerala, India.

---

## Overview

CoolPool is a full-stack ride-sharing platform with three user roles:

| Role              | Portal              | Access                                        |
| ----------------- | ------------------- | --------------------------------------------- |
| **Traveler**      | `/` → search & book | Browse trips, select seats, manage bookings   |
| **Host (Driver)** | `/driver/dashboard` | Create trips, manage bookings, track earnings |
| **Admin**         | `/admin/dashboard`  | Approve drivers, monitor trips, edit banners  |

---

## Tech Stack

### Frontend

| Concern       | Library                             |
| ------------- | ----------------------------------- |
| Framework     | React 19 + TypeScript               |
| Router        | TanStack Router v1 (file-based)     |
| Data fetching | TanStack React Query v5             |
| Forms         | React Hook Form + Zod               |
| UI primitives | Shadcn UI (Radix) — 50+ components  |
| Admin UI      | Ant Design v6                       |
| Icons         | Lucide React                        |
| Styling       | Tailwind CSS v4 (OKLCH color space) |
| Charts        | Recharts                            |
| Carousels     | Embla Carousel                      |

### Backend / Services

| Concern            | Service                                    |
| ------------------ | ------------------------------------------ |
| Database & Auth    | Appwrite (self-hosted at `coolpool.in/v1`) |
| File Storage       | Appwrite Storage buckets                   |
| OAuth              | Google OAuth via Appwrite                  |
| Maps & Routing     | Google Maps API                            |
| Place Autocomplete | Google Places API                          |

### Infrastructure

| Concern          | Tool                                     |
| ---------------- | ---------------------------------------- |
| Build            | Vite 7 + Cloudflare plugin               |
| Runtime          | Node 20 / Cloudflare Workers (edge)      |
| Containerization | Docker + Docker Compose                  |
| Proxy            | Nginx (Appwrite forward) + Traefik (SSL) |
| Package manager  | Bun (lockfile) / npm                     |

---

## Project Structure

```
coolpool-connect/
├── src/
│   ├── routes/                  # File-based page routes
│   ├── components/              # Reusable React components
│   │   └── ui/                 # Shadcn UI primitives
│   ├── hooks/                   # Custom React hooks
│   ├── integrations/
│   │   ├── appwrite/           # Appwrite client, schema, server client
│   │   └── supabase/           # Supabase client (secondary)
│   ├── data/
│   │   └── appwrite-repository.ts  # CRUD layer (trips, bookings, drivers)
│   ├── lib/                     # Pure utilities
│   └── assets/                  # Static assets (logo)
├── appwrite/                    # Appwrite migration scripts
├── scripts/                     # DB setup & permission scripts
├── supabase/                    # Supabase config & generated types
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
├── wrangler.jsonc               # Cloudflare Workers config
└── vite.config.ts
```

---

## Routes

| Path                 | Component               | Purpose                                               |
| -------------------- | ----------------------- | ----------------------------------------------------- |
| `/`                  | `index.tsx`             | Landing page — hero carousel, search, trending routes |
| `/booking/$tripId`   | `booking/$tripId.tsx`   | Seat picker + booking form                            |
| `/members`           | `members.tsx`           | Traveler portal — booking history                     |
| `/trips`             | `trips.tsx`             | Traveler trip history (alternate view)                |
| `/host`              | `host.tsx`              | Host landing & signup CTA                             |
| `/auth`              | `auth.tsx`              | Host/admin login (email + Google OAuth)               |
| `/driver/onboarding` | `driver/onboarding.tsx` | Vehicle registration & document upload                |
| `/driver/dashboard`  | `driver/dashboard.tsx`  | Host trip management                                  |
| `/admin/dashboard`   | `admin/dashboard.tsx`   | Admin panel (Ant Design)                              |
| `/pricing`           | `pricing.tsx`           | Pricing info                                          |
| `/about`             | `about.tsx`             | About page                                            |
| `/terms`             | `terms.tsx`             | Terms of service                                      |
| `/privacy-policy`    | `privacy-policy.tsx`    | Privacy policy                                        |
| `/refund-policy`     | `refund-policy.tsx`     | Refund policy                                         |

---

## Key Components

| Component               | File                                   | Description                                             |
| ----------------------- | -------------------------------------- | ------------------------------------------------------- |
| `TripSearch`            | `components/TripSearch.tsx`            | Autocomplete search with Appwrite query + deduplication |
| `SeatPicker`            | `components/SeatPicker.tsx`            | Interactive 5-seat RHD layout (front + 3 rear)          |
| `SeatMap`               | `components/SeatMap.tsx`               | Read-only seat availability view                        |
| `RideRouteMap`          | `components/RideRouteMap.tsx`          | Google Maps polyline route display                      |
| `HeroCarousel`          | `components/HeroCarousel.tsx`          | Embla-powered homepage banner carousel                  |
| `SiteHeader`            | `components/SiteHeader.tsx`            | Sticky responsive nav with auth state                   |
| `DynamicTrendingRoutes` | `components/DynamicTrendingRoutes.tsx` | Popular routes on homepage                              |
| `GoogleLoginButton`     | `components/GoogleLoginButton.tsx`     | OAuth signin button                                     |
| `BannersManager`        | `components/admin/BannersManager.tsx`  | Admin hero banner editor                                |

---

## Data Model

### Appwrite Collections

| Collection                        | Key Fields                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `coolpool_trips`                  | host_id, from_city, to_city, departure_time, total_price, total_distance_km, seats_available, status |
| `coolpool_trip_stops`             | trip_id, city, sequence, cumulative_distance_km                                                      |
| `coolpool_bookings`               | trip_id, traveler_id, seats, segment_price, status                                                   |
| `coolpool_trip_seat_reservations` | trip_id, seat_index, status (no traveler PII)                                                        |
| `coolpool_drivers`                | user_id, license_number, verification_status                                                         |
| `coolpool_vehicles`               | driver_id, make, model, registration, insurance docs                                                 |
| `coolpool_user_roles`             | user_id, role (`admin` \| `driver` \| `user`)                                                        |
| `coolpool_profiles`               | user_id, display_name, avatar                                                                        |
| `coolpool_pricing_rules`          | route, min_price_per_km, max_price_per_km                                                            |
| `coolpool_hero_banners`           | title, image_url, cta_link, active, order                                                            |

### Storage Buckets

| Bucket                    | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| Driver docs bucket        | License, registration, insurance uploads |
| `coolpool_banners_bucket` | Homepage hero banner images              |

---

## Pricing Engine

Pricing is per-kilometer, calculated at trip creation:

```
price_per_km = total_price / total_distance_km
segment_price = (stop_distance_to - stop_distance_from) × price_per_km
```

Segments are priced at booking time based on the traveler's chosen pickup/drop-off stops. Prices are locked to the rate at time of booking and do not update if the host changes the trip price.

---

## Geolocation & Maps

- **Distance**: Haversine formula for great-circle distance between coordinates
- **Route matching**: Polyline decode from Google Maps + tolerance-based matching for search results
- **City aliases**: Normalized lookup (`Calicut` ↔ `Kozhikode`, `Kochi` ↔ `Ernakulam`)
- **Geocoding fallback**: IP-based city detection when browser geolocation is unavailable
- **Service city**: Configurable via `lib/config.ts` — currently scoped to Kerala routes

---

## Authentication

```
Traveler  → Google OAuth via Appwrite (member portal)
Host      → Email/password or Google OAuth (/auth)
Admin     → Email/password (/auth) with role check
```

OAuth deep-link: after Google redirect, `travelerResumeRedirect.ts` restores the user's original destination (e.g. a booking page).

Role check is done against the `coolpool_user_roles` collection. Phone number can upgrade a traveler account to driver role.

---

## Design System

**Color space**: OKLCH (perceptual, wide-gamut)

| Token              | Value                                 |
| ------------------ | ------------------------------------- |
| Primary brand      | `oklch(0.55 0.25 290)` — deep purple  |
| Accent glow        | `oklch(0.62 0.25 350)` — vibrant pink |
| Gradient (CTA)     | Pink → Purple, 135°                   |
| Border radius base | 2rem (32px)                           |

**Typography**:

- Body: Lexend, Montserrat, Cabin
- Headings: Montserrat, Lexend
- Accent serif: Roboto Slab

**Key visual patterns**: gradient CTAs, glass-morphism header (backdrop-blur), rounded cards with `shadow-glow`, hover scale transitions.

---

## Environment Variables

```env
# Appwrite
APPWRITE_API_KEY=
VITE_APPWRITE_ENDPOINT=https://coolpool.in/v1
VITE_APPWRITE_PROJECT_ID=
VITE_APPWRITE_DATABASE_ID=
VITE_APPWRITE_COLLECTION_TRIPS=
VITE_APPWRITE_COLLECTION_TRIP_STOPS=
VITE_APPWRITE_COLLECTION_BOOKINGS=
VITE_APPWRITE_COLLECTION_SEAT_RESERVATIONS=
VITE_APPWRITE_COLLECTION_USER_ROLES=
VITE_APPWRITE_COLLECTION_DRIVERS=
VITE_APPWRITE_COLLECTION_VEHICLES=
VITE_APPWRITE_COLLECTION_PROFILES=
VITE_APPWRITE_COLLECTION_PRICING_RULES=
VITE_APPWRITE_COLLECTION_HERO_BANNERS=
VITE_APPWRITE_DRIVER_DOCS_BUCKET_ID=
VITE_APPWRITE_BANNERS_BUCKET_ID=

# Google
VITE_GOOGLE_MAPS_API_KEY=

# App
VITE_APP_ORIGIN=                 # Optional: production domain
```

---

## Development

```bash
# Install
bun install        # or: npm install

# Dev server
bun dev            # or: npm run dev

# Build
bun run build

# Type check
bun run typecheck
```

## Deployment

Docker Compose spins up the frontend container with Traefik SSL and an Nginx sidecar that forwards `/v1` traffic to the self-hosted Appwrite instance.

```bash
docker compose up -d
```

SSL is handled by Traefik with `sslip.io` wildcard certificates.
