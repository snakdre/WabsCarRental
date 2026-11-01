"use client";

import { useState, useTransition } from "react";
import { setCustomerFlag, setCustomerActive, updateCustomerNotes, setDocumentVerified } from "@/lib/actions/management-customers";
import { Button } from "@/components/ui/button";

type Result = { success?: true; error?: string };

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, onOk?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else onOk?.();
    });
  };
  return { error, isPending, run };
}

const form = (e: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, v);
  return f;
};

export function CustomerStatusControls({
  customerId, flagged, isActive,
}: {
  customerId: string; flagged: boolean; isActive: boolean;
}) {
  const { error, isPending, run } = useAction();
  return (
    <div className="space-y-3" data-testid="customer-status-controls">
      <Button
        onClick={() => run(() => setCustomerFlag(form({ customer_id: customerId, flagged: String(!flagged) })))}
        disabled={isPending}
        variant="outline"
        className={`w-full ${flagged ? "" : "border-red-300 text-red-700 hover:bg-red-50"}`}
      >
        {flagged ? "Remove flag" : "Flag customer"}
      </Button>
      <Button
        onClick={() => {
          if (isActive && !confirm("Deactivate this customer? They'll keep their history but be marked inactive.")) return;
          run(() => setCustomerActive(form({ customer_id: customerId, is_active: String(!isActive) })));
        }}
        disabled={isPending}
        variant="outline"
        className="w-full"
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

export function CustomerNotesEditor({ customerId, initialNotes }: { customerId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const { error, isPending, run } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(() => updateCustomerNotes(form({ customer_id: customerId, notes })), () => setSaved(true));
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">
        Internal notes (staff only)
      </label>
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        maxLength={4000}
        placeholder="Add notes about this customer…"
        className="w-full min-h-[120px] border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Saving…" : "Save notes"}
        </Button>
        {saved && <span className="text-green-700 text-sm">Saved</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </form>
  );
}

export function DocumentVerifyButton({ documentId, verified }: { documentId: string; verified: boolean }) {
  const { error, isPending, run } = useAction();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => setDocumentVerified(form({ document_id: documentId, verified: String(!verified) })))}
        className={verified ? "text-text-muted-wabs hover:underline text-sm" : "text-gold hover:underline text-sm font-semibold"}
      >
        {verified ? "Unverify" : "Verify"}
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </span>
  );
}
