// SERVER-ONLY. Finalizes a paid booking with admin rights.
//
// Booking documents must grant read/update to BOTH the traveler and the trip
// host (the host's dashboard reads bookings via document permissions). A
// browser session can only grant permissions to itself, so creating the
// booking client-side works for hosts booking their own trips and fails with
// "Permissions must be one of: (any, users, user:<self>…)" for every real
// cross-account booking — after the payment was already captured. This server
// function re-verifies the Razorpay signature and writes the booking + seat
// reservations with the admin key instead.
import { createServerFn } from "@tanstack/react-start";
import { ID, Permission, Query, Role } from "node-appwrite";
import crypto from "crypto";
import { appwriteDatabases, appwriteServerConfig } from "./client.server";
import { getCollectionIds } from "./schema";
import { normalizePhone } from "@/lib/identity-normalizers";

interface FinalizePassenger {
  seatCode: string;
  name: string;
  phone: string;
  gender: "male" | "female";
}

export interface FinalizeBookingInput {
  booking: {
    tripId: string;
    travelerId: string;
    fromStopIndex: number;
    toStopIndex: number;
    segmentPrice: number;
    passengerName: string;
    passengerPhone: string;
    passengers: FinalizePassenger[];
    seatCodes: string[];
  };
  payment: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
}

/** Same stable doc id scheme as the client repository (one doc per trip+seat). */
function seatReservationDocId(tripId: string, seatCode: string): string {
  const slug = seatCode.replace(/[^a-zA-Z0-9]/g, "_");
  const joined = `${tripId}_${slug}`;
  if (joined.length <= 36) return joined;
  return `${tripId.slice(-14)}_${slug}`.slice(0, 36);
}

function generateBookingOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

export const finalizeBookingServer = createServerFn({ method: "POST" })
  .inputValidator((input: FinalizeBookingInput) => {
    const b = input?.booking;
    const p = input?.payment;
    if (!b || !p) throw new Error("Missing booking or payment data.");
    const tripId = String(b.tripId ?? "").trim();
    const travelerId = String(b.travelerId ?? "").trim();
    const seatCodes = Array.isArray(b.seatCodes) ? b.seatCodes.map(String).filter(Boolean) : [];
    const passengers = Array.isArray(b.passengers) ? b.passengers : [];
    if (!tripId || !travelerId) throw new Error("Missing trip or traveler.");
    if (seatCodes.length === 0) throw new Error("Select at least one seat.");
    if (passengers.length !== seatCodes.length) {
      throw new Error("Passenger details are required for every seat.");
    }
    const order_id = String(p.razorpay_order_id ?? "").trim();
    const payment_id = String(p.razorpay_payment_id ?? "").trim();
    const signature = String(p.razorpay_signature ?? "").trim();
    if (!order_id || !payment_id || !signature) {
      throw new Error("Missing payment verification fields.");
    }
    return {
      booking: {
        tripId,
        travelerId,
        fromStopIndex: Number(b.fromStopIndex) || 0,
        toStopIndex: Number(b.toStopIndex) || 0,
        segmentPrice: Number(b.segmentPrice) || 0,
        passengerName: String(b.passengerName ?? ""),
        passengerPhone: String(b.passengerPhone ?? ""),
        passengers,
        seatCodes,
      },
      payment: {
        razorpay_order_id: order_id,
        razorpay_payment_id: payment_id,
        razorpay_signature: signature,
      },
    };
  })
  .handler(async ({ data }): Promise<{ bookingId: string }> => {
    // 1. The payment signature is the proof-of-payment gate: a booking can
    //    only be finalised for an order Razorpay actually signed as paid.
    const secret = readEnv("RAZORPAY_KEY_SECRET");
    if (!secret) throw new Error("Razorpay secret missing on the server.");
    const body = `${data.payment.razorpay_order_id}|${data.payment.razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (expected !== data.payment.razorpay_signature) {
      throw new Error("Payment signature verification failed.");
    }

    const db = appwriteServerConfig.databaseId;
    const c = getCollectionIds();
    const databases = appwriteDatabases;
    const b = data.booking;

    // 2. The trip must exist; its host gets read/update on the booking.
    const trip = await databases.getDocument(db, c.trips, b.tripId);
    const hostId = String(trip.host_id ?? "");
    if (!hostId) throw new Error("Trip has no host.");

    // 3. Seat availability (same check as the old client path).
    const occupiedRes = await databases.listDocuments(db, c.tripSeatReservations, [
      Query.equal("trip_id", b.tripId),
      Query.limit(100),
    ]);
    const occupied = new Set(occupiedRes.documents.map((d: any) => String(d.seat_code)));
    for (const code of b.seatCodes) {
      if (occupied.has(code)) {
        throw new Error(`Seat ${code} is no longer available. Refresh and try again.`);
      }
    }

    // 4. One mobile number can't hold two active seats on the same trip
    //    (cancelled bookings are ignored so passengers can cancel and rebook).
    const newPhones = b.passengers.map((p) => normalizePhone(p.phone)).filter(Boolean);
    if (newPhones.length) {
      const bookingsRes = await databases.listDocuments(db, c.bookings, [
        Query.equal("trip_id", b.tripId),
        Query.limit(100),
      ]);
      const existingPhones = new Set<string>();
      for (const doc of bookingsRes.documents as any[]) {
        if (doc.status === "cancelled") continue;
        try {
          for (const p of JSON.parse(doc.passengers_json || "[]")) {
            const norm = normalizePhone(p?.phone);
            if (norm) existingPhones.add(norm);
          }
        } catch {
          /* legacy bookings without passengers_json */
        }
        for (const part of String(doc.passenger_phone ?? "").split("|")) {
          const norm = normalizePhone(part.trim());
          if (norm) existingPhones.add(norm);
        }
      }
      const dup = newPhones.find((p) => existingPhones.has(p));
      if (dup) {
        throw new Error(
          "This mobile number already has a booking on this trip. Cancel that booking first to rebook.",
        );
      }
    }

    // 5. Create the booking with full permissions for traveler AND host —
    //    allowed here because this runs with the admin key.
    const payload: Record<string, unknown> = {
      trip_id: b.tripId,
      traveler_id: b.travelerId,
      from_stop_index: b.fromStopIndex,
      to_stop_index: b.toStopIndex,
      seats_booked: b.seatCodes.length,
      segment_price: b.segmentPrice,
      passenger_name: b.passengerName,
      passenger_phone: b.passengerPhone,
      status: "confirmed",
      otp: generateBookingOtp(),
      verified: false,
      passengers_json: JSON.stringify(b.passengers),
      payment_method: "pay_online",
      payment_reference: data.payment.razorpay_payment_id,
    };
    const bookingPerms = [
      Permission.read(Role.user(b.travelerId)),
      Permission.update(Role.user(b.travelerId)),
      Permission.read(Role.user(hostId)),
      Permission.update(Role.user(hostId)),
    ];

    let bookingDoc;
    try {
      bookingDoc = await databases.createDocument(db, c.bookings, ID.unique(), payload, bookingPerms);
    } catch (err) {
      // A missing optional attribute on the bookings collection must NEVER cost
      // a paid customer their booking — retry with only the core fields.
      console.warn("[finalizeBooking] create failed — retrying without optional attributes.", err);
      delete payload.otp;
      delete payload.verified;
      delete payload.payment_method;
      delete payload.payment_reference;
      delete payload.passengers_json;
      bookingDoc = await databases.createDocument(db, c.bookings, ID.unique(), payload, bookingPerms);
    }

    // 6. Seat reservations — deterministic doc ids double as optimistic locks
    //    (a concurrent booking of the same seat fails on the duplicate id).
    const createdSeatIds: string[] = [];
    try {
      for (const seatCode of b.seatCodes) {
        const passenger = b.passengers.find((p) => p.seatCode === seatCode);
        const seatPayload: Record<string, unknown> = {
          trip_id: b.tripId,
          seat_code: seatCode,
          booking_id: bookingDoc.$id,
        };
        if (passenger?.gender) seatPayload.gender = passenger.gender;
        const seatPerms = [
          Permission.read(Role.any()),
          Permission.delete(Role.user(b.travelerId)),
          Permission.delete(Role.user(hostId)),
        ];
        const docId = seatReservationDocId(b.tripId, seatCode);
        try {
          await databases.createDocument(db, c.tripSeatReservations, docId, seatPayload, seatPerms);
        } catch (err) {
          // The `gender` attribute may not exist on the collection — retry without it.
          if (seatPayload.gender !== undefined) {
            delete seatPayload.gender;
            await databases.createDocument(db, c.tripSeatReservations, docId, seatPayload, seatPerms);
          } else {
            throw err;
          }
        }
        createdSeatIds.push(docId);
      }
    } catch (error) {
      // Roll back so a half-created booking never blocks seats.
      for (const id of createdSeatIds) {
        try {
          await databases.deleteDocument(db, c.tripSeatReservations, id);
        } catch {
          /* ignore */
        }
      }
      try {
        await databases.deleteDocument(db, c.bookings, bookingDoc.$id);
      } catch {
        /* ignore */
      }
      throw error;
    }

    return { bookingId: bookingDoc.$id };
  });
