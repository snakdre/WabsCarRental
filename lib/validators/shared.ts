import { z } from "zod";

// Hex-shape UUID matcher. Zod's built-in `.uuid()` enforces RFC-4122 version
// 1-8 in the version nibble, which rejects memorable seed UUIDs like
// aaaaaaaa-0000-0000-0000-000000000001. Postgres accepts those, so we match
// on hex-shape only everywhere server actions touch IDs.
export const uuidLike = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

// Strict YYYY-MM-DD date string (not a full ISO timestamp).
export const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
