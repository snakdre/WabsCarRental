// Liveness probe for Docker / Nginx. Deliberately does not touch Supabase,
// so a database blip doesn't cause the container to be restarted.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
