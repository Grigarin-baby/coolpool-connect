import type { Booking, BookingPassenger } from "@/lib/domain";

export function getBookingPassengers(booking: Booking): BookingPassenger[] {
  if (booking.passengers?.length) return booking.passengers;

  const names = (booking.passengerName || "").split("|").map((value) => value.trim());
  const phones = (booking.passengerPhone || "").split("|").map((value) => value.trim());

  return names.map((raw, index) => {
    const match = raw.match(/^Seat\s+([^:]+):\s*(.*)$/i);
    return {
      seatCode: match ? match[1] : String(index + 1),
      name: match ? match[2] : raw,
      phone: phones[index] || phones[0] || "",
      gender: undefined,
    } as BookingPassenger;
  });
}
