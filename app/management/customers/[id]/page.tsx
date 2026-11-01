import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Flag } from "lucide-react";
import { getCustomerDetail } from "@/lib/queries/management-customers";
import { DOCUMENT_TYPE_LABEL } from "@/lib/validators/account";
import { formatMoney } from "@/lib/utils/format";
import { StatusPill } from "@/components/shared/status-pill";
import {
  CustomerStatusControls, CustomerNotesEditor, DocumentVerifyButton,
} from "@/components/management/customers/customer-controls";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-text-muted-wabs">{label}</dt>
      <dd className="text-sm text-navy mt-0.5">{value || "—"}</dd>
    </div>
  );
}

export default async function ManagementCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCustomerDetail(id);
  if (!c) notFound();

  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
  const address = c.address ? [c.address.line1, c.address.city, c.address.state, c.address.zip].filter(Boolean).join(", ") : null;

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link href="/management/customers" className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to customers
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-navy">{name}</h1>
        {c.flagged && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium bg-red-100 text-red-700">
            <Flag className="w-3 h-3" /> Flagged
          </span>
        )}
        {!c.is_active && <span className="text-xs px-2 py-1 rounded font-medium bg-gray-200 text-gray-700">Inactive</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Profile</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="Email" value={c.email} />
              <Info label="Phone" value={c.phone} />
              <Info label="Date of birth" value={c.date_of_birth} />
              <Info label="Customer since" value={c.created_at.slice(0, 10)} />
              <div className="sm:col-span-2"><Info label="Address" value={address} /></div>
            </dl>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex justify-between items-baseline p-6 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Booking history</h2>
              <p className="text-sm text-navy">
                {c.stats.booking_count} booking{c.stats.booking_count === 1 ? "" : "s"} · {formatMoney(c.stats.total_spent)} spent
              </p>
            </div>
            {c.bookings.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-text-muted-wabs">No bookings yet.</p>
            ) : (
              <table className="w-full text-sm" data-testid="customer-bookings">
                <thead className="bg-gray-50 text-text-muted-wabs uppercase text-xs tracking-wider">
                  <tr>
                    <th className="text-left px-6 py-2">Reference</th>
                    <th className="text-left px-4 py-2">Vehicle</th>
                    <th className="text-left px-4 py-2">Dates</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-6 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {c.bookings.map(b => (
                    <tr key={b.id} className="border-t border-gray-100">
                      <td className="px-6 py-2 font-mono">
                        <Link href={`/management/bookings/${b.id}`} className="text-navy hover:text-gold">{b.reference}</Link>
                      </td>
                      <td className="px-4 py-2 text-navy">{b.vehicle}</td>
                      <td className="px-4 py-2 text-navy">{b.pickup_date.slice(0, 10)} → {b.return_date.slice(0, 10)}</td>
                      <td className="px-4 py-2"><StatusPill status={b.status} /></td>
                      <td className="px-6 py-2 text-right text-navy font-semibold">{formatMoney(b.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Documents</h2>
            {c.documents.length === 0 ? (
              <p className="text-sm text-text-muted-wabs">No documents uploaded.</p>
            ) : (
              <ul className="divide-y divide-gray-100" data-testid="customer-documents">
                {c.documents.map(d => (
                  <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="text-navy font-medium">
                        {DOCUMENT_TYPE_LABEL[d.type as keyof typeof DOCUMENT_TYPE_LABEL] ?? d.type}
                      </p>
                      <p className="text-xs text-text-muted-wabs">Uploaded {d.uploaded_at.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${d.verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {d.verified ? "Verified" : "Needs review"}
                      </span>
                      {d.signed_url && (
                        <a href={d.signed_url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">View</a>
                      )}
                      <DocumentVerifyButton documentId={d.id} verified={d.verified} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs mb-4">Actions</h2>
            <CustomerStatusControls customerId={c.id} flagged={c.flagged} isActive={c.is_active} />
          </section>
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <CustomerNotesEditor customerId={c.id} initialNotes={c.internal_notes} />
          </section>
        </aside>
      </div>
    </main>
  );
}
