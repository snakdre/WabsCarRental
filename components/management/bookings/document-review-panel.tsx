import Link from "next/link";
import type { CustomerDocument } from "@/lib/queries/management-customers";
import { DOCUMENT_TYPE_LABEL } from "@/lib/validators/account";
import { DocumentVerifyButton } from "@/components/management/customers/customer-controls";

export function DocumentReviewPanel({ customerId, documents }: { customerId: string; documents: CustomerDocument[] }) {
  const hasLicence = documents.some(d => d.verified && (d.type === "license_front" || d.type === "license_back"));
  return (
    <div className="space-y-3" data-testid="document-review">
      <div className={`text-xs rounded px-2 py-1 ${hasLicence ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
        {hasLicence ? "Verified licence on file" : "No verified licence on file. Check the physical licence at pickup."}
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-text-muted-wabs">The customer hasn&apos;t uploaded any documents.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documents.map(d => (
            <li key={d.id} className="py-2 flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="text-navy">{DOCUMENT_TYPE_LABEL[d.type as keyof typeof DOCUMENT_TYPE_LABEL] ?? d.type}</p>
                <p className={`text-xs ${d.verified ? "text-green-700" : "text-yellow-700"}`}>{d.verified ? "Verified" : "Needs review"}</p>
              </div>
              <div className="flex items-center gap-3">
                {d.signed_url && (
                  <a href={d.signed_url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">View</a>
                )}
                <DocumentVerifyButton documentId={d.id} verified={d.verified} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/management/customers/${customerId}`} className="text-xs text-gold hover:underline">Open customer profile →</Link>
    </div>
  );
}
