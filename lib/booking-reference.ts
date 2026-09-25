// WBS-YYYY-XXXXXX — 6 chars from a 32-char alphabet (no I/O/0/1 for readability).
// Collision probability at seed volume is negligible; server action retries once on collision.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingReference(date: Date = new Date()): string {
  const year = date.getFullYear();
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `WBS-${year}-${suffix}`;
}
