import Link from "next/link";
import type { ActivityItem } from "@/lib/queries/management-dashboard";
import { StatusPill } from "@/components/shared/status-pill";

function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : iso.slice(0, 10);
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg" data-testid="activity-feed">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-text-muted-wabs">No booking activity yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map(a => (
            <li key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/management/bookings/${a.booking_id}`} className="font-mono text-sm text-navy hover:text-gold">
                    {a.reference}
                  </Link>
                  <StatusPill status={a.status} />
                </div>
                {a.note && <p className="text-xs text-text-muted-wabs mt-1 truncate">{a.note}</p>}
              </div>
              <time dateTime={a.created_at} className="text-xs text-text-muted-wabs shrink-0">{timeAgo(a.created_at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
