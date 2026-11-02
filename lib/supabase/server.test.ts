import { describe, it, expect, vi } from "vitest";

// The service client must never read the request's auth cookies. supabase-js
// prefers a session token over the key it was created with, so a cookie-aware
// "service" client silently runs as the signed-in user: RLS applies and the
// service-only booking RPC is denied. That broke checkout and manual booking.
const cookies = vi.fn(() => {
  throw new Error("createServiceClient must not read request cookies");
});
vi.mock("next/headers", () => ({ cookies }));
// React's cache() only exists inside the Next/RSC runtime.
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
// Capture how the service client is constructed instead of building a real one
// (supabase-js needs a WebSocket implementation on Node 20).
const createSupabaseClient = vi.fn((url: string, key: string, opts: unknown) => ({ url, key, opts }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createSupabaseClient }));

describe("createServiceClient", () => {
  it("builds a client without touching request cookies", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { createServiceClient } = await import("./server");
    const client = await createServiceClient();
    expect(client).toBeTruthy();
    expect(cookies).not.toHaveBeenCalled();
    expect(createSupabaseClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }),
    );
  });
});
