# Landing Page Change Plan

## Summary of 5 Requirements

---

## 1. Profile Modal — Show Logged-In User Info

**File:** `src/components/UserProfileDialog.tsx`

**Root cause:** The `UserProfileDialog` already renders name/email/roles correctly, but for Google OAuth users, `user.name` is often blank in Appwrite, meaning the large top display shows only the email prefix (e.g. "john.doe" instead of "John Doe"). The "Display name" row in the detail list then shows "—", making it look like no one is logged in.

**What I'll fix:**

- In the avatar header section, display the full email below the display-name as a secondary line (currently email only appears if the name is set, but it should always be visible).
- In the detail list, replace the "Display name" row with a "Name" row that shows `user.name` if set, and otherwise shows a friendly note like "Set via Google account" so it doesn't look empty.
- Ensure the dialog title changes from the generic "My profile" to `"Hi, [displayName]"` so it's immediately clear who is signed in.
- No logic changes — purely presentation fixes in `UserProfileDialog.tsx`.

---

## 2. Trip Search — Font Size 4× Larger

**Files:**

- `src/styles.css` (CSS classes `trip-search-label`, `trip-search-autocomplete` selectors)
- `src/components/TripSearch.tsx` (date chip button classes)

**Current sizes:**
| Element | Current | Target (4×) |
|---------|---------|-------------|
| Section label ("Pickup", "Destination") | `1.125rem` | `~2.5rem` |
| Input/autocomplete text | `1.375rem` mobile · `1.5rem` desktop | `~3.5rem` mobile · `~4rem` desktop |
| Placeholder text | `1.1875rem` | `~3rem` |
| Date chip buttons ("Today", "Tomorrow") | `text-sm` / `text-lg` | `text-4xl` / `text-5xl` |

**What I'll change:**

- In `styles.css`, update the `.trip-search-label` font-size rules from `1.125rem` → `~2.5rem`.
- Update the `.trip-search-autocomplete` input/selection/placeholder font-size rules from `1.375–1.5rem` → `~4rem` desktop, `~3.5rem` mobile.
- In `TripSearch.tsx`, increase the date chip button text classes on desktop and mobile to match (approx. `text-4xl font-black`).
- Increase the desktop container `min-h` from `7.5rem` to accommodate the taller text (around `10–11rem`).
- Increase the icon sizes (currently `size={24}`) to `size={36}` to stay proportional.

> **Note:** At true 4× the text would be ~88px, which fills the full search bar. I will apply exactly 4× on the input text and scale labels proportionally so the form remains usable.

---

## 3. Trip Search — Remove Search Button

**File:** `src/components/TripSearch.tsx`

**What I'll remove:**

- Desktop: the `flex: "0 0 18%"` column div containing the `<UiButton type="submit" …>Search</UiButton>` (lines 592–609).
- Mobile: the `<div className="px-2 pt-2 pb-2">` section containing the mobile Search button (lines 690–706).

**How search will still trigger:**

- When user clicks **Today** or **Tomorrow** chip, call `form.submit()` after setting the date value — so picking a date auto-fires the search.
- The desktop layout will redistribute its flex percentages: Pickup 30%, Destination 38%, Date 32% (no Search column).

**What stays the same:** All search logic, results rendering, and loading state are untouched.

---

## 4. Driver Dashboard — Responsive Date Picker

**File:** `src/routes/driver/dashboard.tsx` (around line 1338)

**Root cause:** The Ant Design `DatePicker` popup renders as a fixed-position overlay that overflows the viewport on small screens. The current class `className="w-full h-14 rounded-3xl text-lg"` does not constrain the popup.

**What I'll fix:**

- Add `popupClassName="datepicker-responsive"` prop to the `DatePicker`.
- Add CSS in the dashboard or global styles for `.datepicker-responsive .ant-picker-panel-container` to enforce `max-width: 100vw`, `overflow-x: hidden`, and `left: 0 !important` on mobile (`@media (max-width: 640px)`).
- Add `placement="bottomLeft"` so the popup anchors to the left edge of the input on small screens instead of centering.
- Wrap the `Form.Item` containing `DatePicker` in a `relative` positioned div so the popup has a proper anchor.

---

## 5. Trending Routes Cards — From / To / Date Only

**File:** `src/components/DynamicTrendingRoutes.tsx`

**Current card structure (to be removed):**

- Top section: Driver avatar, "Verified Host" label, star rating ("4.8 · 120 trips"), Verified badge
- Middle section: Departure time (hh:mm A), date (MMM DD), route timeline dots with from/to city names
- Bottom section: Car type chip ("Standard Sedan"), seats-left badge, price (₹X /seat), Book button with chevron

**New card structure (keep only):**

- A clean route row: `[From city]` → `[To city]` (bold, truncated)
- Date line: formatted date e.g. "Mon, Jun 2" (muted, smaller)
- A subtle right-arrow or chevron to indicate it's tappable

**Implementation:**

- Replace the existing multi-section card body entirely in the `trips.map(…)` render.
- Keep the `Link` wrapper, `Card`, hover styles, and `rounded-3xl` so tapping still navigates to booking.
- Remove all imports no longer needed after the cleanup: `Star`, `ShieldCheck`, `Clock`, `CarFront`, `formatCurrency`, `MapPin` (check if still used elsewhere before removing imports).

**New card mockup:**

```
┌─────────────────────────────────┐
│  Kozhikode  →  Bangalore        │
│  Mon, Jun 2                     │
│                                 │ ›
└─────────────────────────────────┘
```

---

## Files Changed Summary

| File                                       | Changes                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/components/UserProfileDialog.tsx`     | Always show email; fix empty-name display                                                      |
| `src/styles.css`                           | Increase trip-search font sizes ~4×                                                            |
| `src/components/TripSearch.tsx`            | Larger icon sizes; remove Search button; auto-submit on date chip click; rebalance flex widths |
| `src/routes/driver/dashboard.tsx`          | Add `popupClassName` + `placement` to DatePicker; add responsive CSS                           |
| `src/components/DynamicTrendingRoutes.tsx` | Strip card to from / to / date only                                                            |

No routing, auth, data-fetching, or business logic changes are needed for any of these.
