"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument, deleteDocument } from "@/lib/actions/account";
import type { MyDocument } from "@/lib/queries/account";
import {
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, DOCUMENT_MIME_TYPES, DOCUMENT_MAX_BYTES,
} from "@/lib/validators/account";
import { Button } from "@/components/ui/button";

export function DocumentsPanel({ documents }: { documents: MyDocument[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    // Client-side pre-check for fast feedback; the server re-validates.
    if (file instanceof File) {
      if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
        setError("File must be JPEG, PNG, WebP or PDF"); return;
      }
      if (file.size > DOCUMENT_MAX_BYTES) { setError("File must be 10 MB or smaller"); return; }
    }
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (res?.error) setError(res.error);
      else { setMessage("Uploaded. Our team will review it shortly."); formRef.current?.reset(); }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm("Remove this document?")) return;
    const fd = new FormData();
    fd.set("id", id);
    setError(null);
    startTransition(async () => {
      const res = await deleteDocument(fd);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-6" data-testid="documents-panel">
      <form ref={formRef} onSubmit={onUpload} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <p className="text-sm text-text-muted-wabs">
          Upload your driver&apos;s licence (front and back) or passport so we can verify you before pickup.
          JPEG, PNG, WebP or PDF, up to 10 MB.
        </p>
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted-wabs mb-1">Type</span>
            <select name="type" className="border border-gray-300 rounded px-3 py-2 text-sm text-navy bg-white" defaultValue="license_front">
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="block flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted-wabs mb-1">File</span>
            <input
              name="file" type="file" required
              accept={DOCUMENT_MIME_TYPES.join(",")}
              className="block w-full text-sm text-navy file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:rounded"
            />
          </label>
          <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {message && <p className="text-green-700 text-sm">{message}</p>}
      </form>

      {documents.length === 0 ? (
        <p className="text-sm text-text-muted-wabs">No documents uploaded yet.</p>
      ) : (
        <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {documents.map(d => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="text-navy font-medium">{DOCUMENT_TYPE_LABEL[d.type as keyof typeof DOCUMENT_TYPE_LABEL] ?? d.type}</p>
                <p className="text-xs text-text-muted-wabs">Uploaded {d.uploaded_at.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded font-medium ${d.verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                  {d.verified ? "Verified" : "Pending review"}
                </span>
                {d.signed_url && (
                  <a href={d.signed_url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">View</a>
                )}
                {!d.verified && (
                  <button type="button" onClick={() => onDelete(d.id)} disabled={isPending} className="text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
