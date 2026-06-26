# Coolpool Admin Dashboard — Master Plan

A single, trustworthy control room for running Coolpool: find anyone in seconds,
open any record to its full depth, and act with confidence on real, reconciled numbers.

## Design principles
1. **Everything is clickable.** Any name, trip, car, or booking opens its full detail. You can always go deeper.
2. **One search everywhere.** The same search box (phone / email / user ID / route) on every list.
3. **One detail panel.** A consistent slide-up drawer reused across the whole panel, so it always feels the same.
4. **Numbers you can trust.** Every money figure traces back to specific completed trips. No mystery totals.
5. **Safe by design.** Powerful actions (create user, reset password, cancel, verify) re-check you're an admin on the server before running.
6. **Calm, consistent UI.** Same status words and colors everywhere (Scheduled / Completed / Cancelled / Expired), generous spacing, clear primary actions.

## Navigation (final)
Overview · Guest Management · Host Management · Driver Directory · Trip Manager · Booking Manager · Payouts · Banners Manager · Deleted Accounts
*(Removed: Vehicle Manager, Pricing Rules, System Settings — see notes.)*

---

## 1. Overview — the control room home
The first thing you see: a few large, tappable stat cards (hosts, guests, trips, bookings, revenue, your 5% platform earnings) and a **"needs attention today"** strip — hosts pending verification, payout requests waiting, trips departing today, new bookings. Each item jumps straight to the right place.
*Example: "3 payout requests pending" → tap → land in Payouts.*

## 2. Guest Management 🧳 — people who book
A searchable list of everyone who has booked a ride (search by phone / email / ID).
Tap a guest → drawer with:
- **Identity:** name, email, phone, gender, user ID, first-seen date.
- **Every trip they booked:** route, date, seat, ₹ paid, status, boarding OTP, and the host they rode with — each tappable to open the trip.
- **Actions:** Make Admin · Reset password · **+ Create guest**.
*Example: a rider says "my booking disappeared" → search their number → see all their bookings instantly.*

## 3. Host Management 🚗 — people who offer rides (the heart of the panel)
A searchable list of all hosts (anyone with a driver profile).
Tap a host → drawer with **everything in one place**:
- **Full profile / what they entered while verifying:** name, email, phone, license number, city, bio, photo, gender, ride rules (smoking/alcohol/music/pets), verification status + note, rating.
- **Their vehicles:** each car (model, plate, color, seats) with its **RC / insurance documents** and **Approve / Reject right here** — vehicle verification happens in the host's context, not a separate list.
- **Their drivers:** any team drivers they added, with full details.
- **Every trip they hosted, and who came:** for each trip — route, date, status, money (total collected, your 5% cut, host's net), and the **full passenger list** (name, phone, gender, seat, paid, OTP/verified).
- **Actions:** Verify / Unverify · Activate / Deactivate · Make Admin · Reset password · **+ Create host**.
*Example: "who rode in KING ANNA's car on the 24th?" → tap KING ANNA → that trip → passenger list. Two taps.*

## 4. Driver Directory ✅ — the verification fast-lane
A focused queue showing hosts/drivers that **need review** first, with quick **Verify / Reject (with reason)**. Full records still live in Host Management; this stays the speedy approve/reject lane so you're never hunting.
*Example: new host signs up → appears here as "Pending" → Verify in one tap.*

## 5. Trip Manager 🗺️ — every ride, monitored
The list stays (route, departure, seats, price, status) with **search** (route/host) and a **status filter**. Now **every trip is tappable** → the shared trip drawer:
- **Whose trip:** host + assigned driver + the car used.
- **Who was there:** full passenger list.
- **The money:** total collected, your 5% cut, host's net.
- **Click anything to go deeper:** host → host detail, passenger → guest detail, car → vehicle detail.
- **Action:** Cancel a trip (frees all riders' seats).
*Example: host calls to cancel → find the trip → cancel; everyone is released.*

## 6. Booking Manager 🎫 — every booking
List of all bookings with **search** (passenger phone/name, route) and **status filter**. Tap a booking → full detail (passenger, seat, OTP, the trip, the host). **Cancel** when needed.
*Example: a seat dispute → search the phone → see exactly what was booked and on which trip.*

## 7. Payouts 💸 — accurate, auditable money (rebuilt)
**Foundation rule:** a host's earnings = **95%** of (seat price × seats) for **non-cancelled bookings on COMPLETED trips** — identical to the host dashboard, so figures always match.

**Top summary (platform-wide, exact):** Total host earnings · Total paid out · Pending + processing · **Outstanding balance owed** (earnings − paid − pending).

**Tab 1 — Requests (action queue):** each request shows host, amount requested, bank/UPI, date, status, **plus a live check** of their total earned / already paid / available now, with a ✅/⚠️ flag (e.g. "requesting ₹500 of ₹684 available" vs an over-request in red). Actions: Mark Processing · Mark Paid (with UTR) · Reject (with reason).

**Tab 2 — Earnings by host (ledger):** searchable table of every host — Total earned (net) · Paid out · Pending · **Available**. Tap a host → the **breakdown that proves the number** (the exact completed trips contributing) + their full request history.

**Guarantees:** available = earned − paid − pending, recalculated live; cancelled bookings and not-yet-completed trips never count; marking paid reduces available, rejecting frees it; every total traces to specific trips.

## 8. Banners Manager 🖼️
Create / edit / delete the home-page hero banners, with **drag-to-reorder** and an **active/inactive toggle** so promos can be scheduled without deleting.

## 9. Deleted Accounts 🗂️
Read-only archive of removed accounts (name, phone, email, roles, user ID, deleted date) for your records, now with **search**.

---

## Admin powers (server-backed, admin-verified)
Two new abilities run as secure server functions (same proven mechanism as the existing account-deletion function); each verifies the caller is an admin before acting:
- **Reset password** — set a new password for any user (you can't *view* an existing one — passwords are stored scrambled/one-way; this is the safe equivalent).
- **Create new host or guest** — admin form (name, email, phone, gender, starting password, role); host also gets a driver profile.

## What we removed (and why it's fine)
- **Vehicle Manager** → vehicles now live inside each host's detail (verify them in context).
- **Pricing Rules** & **System Settings** → the platform rules (5% fee, 30-min booking cutoff, 45-min hosting lead time, min/max ₹/km) stay as fixed values in code; changes are a quick dev tweak + deploy.

## Build order (phased, shippable)
1. **Guest + Host Management** with search + detail drawers (the big new value; vehicles & drivers inside Host).
2. **Trip Manager + Booking Manager** tap-through detail drawers + search/filter.
3. **Payouts** rebuild (summary, request checks, earnings-by-host ledger).
4. **Admin powers:** Reset password + Create host/guest (server functions).
5. **Polish:** Overview "needs attention", Driver Directory queue, Banners reorder, Deleted Accounts search, consistent status wording/colors.
