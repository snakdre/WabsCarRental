"use client";

import { useState, useTransition } from "react";
import { confirmPayment } from "@/lib/actions/checkout";
import { Button } from "@/components/ui/button";

function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function PaymentForm({ bookingRef, total }: { bookingRef: string; total: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");

  const formatNum = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!luhn(num)) { setError("Invalid card number."); return; }

    const fd = new FormData();
    fd.set("booking_ref", bookingRef);
    fd.set("card_number", num.replace(/\s+/g, ""));
    fd.set("card_expiry", exp);
    fd.set("card_cvc", cvc);
    fd.set("card_zip", zip);

    startTransition(async () => {
      const res = await confirmPayment(fd);
      if (res && "error" in res) setError(res.error);
      // On success the server action calls redirect() and throws — control never returns here.
    });
  };

  const inp = "w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none";
  const lbl = "block text-xs uppercase tracking-wider text-text-muted-wabs mb-2";

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="payment-form">
      <div>
        <label className={lbl}>Card number</label>
        <input required value={num} onChange={(e) => setNum(formatNum(e.target.value))}
          placeholder="4242 4242 4242 4242" inputMode="numeric" className={inp} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Expiry (MM/YY)</label>
          <input required value={exp} onChange={(e) => setExp(formatExp(e.target.value))} placeholder="12/28" className={inp} />
        </div>
        <div>
          <label className={lbl}>CVC</label>
          <input required value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Billing ZIP</label>
        <input required value={zip} onChange={(e) => setZip(e.target.value)} placeholder="90210" className={inp} />
      </div>
      <p className="text-xs text-text-muted-wabs">Mock payment — no real charge is made.</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold w-full">
        {isPending ? "Processing..." : `Pay ${total} & confirm`}
      </Button>
    </form>
  );
}
