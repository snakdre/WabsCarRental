// Booking status state machine.
// Terminal states (empty transition arrays): completed, cancelled, rejected, refunded.
// draft and awaiting_payment are unused by the current customer flow but retained
// for completeness (match the CHECK constraint from migration 012).

export const BOOKING_STATUSES = [
  "draft", "pending", "awaiting_payment", "confirmed",
  "ready_for_pickup", "active", "completed",
  "cancelled", "rejected", "refunded",
] as const;

export type BookingStatus = typeof BOOKING_STATUSES[number];

export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["confirmed", "rejected", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["ready_for_pickup", "cancelled", "refunded"],
  ready_for_pickup: ["active", "cancelled", "refunded"],
  active: ["completed", "refunded"],
  completed: [],
  cancelled: [],
  rejected: [],
  refunded: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatusesFor(current: BookingStatus): BookingStatus[] {
  return TRANSITIONS[current] ?? [];
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  refunded: "Refunded",
};

export const DESTRUCTIVE_TRANSITIONS: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "cancelled", "rejected", "refunded",
]);

export function isBookingStatus(s: string): s is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(s);
}
