"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type CarriedParams = {
  vehicle: string;
  pickup: string;
  return: string;
  pickup_method: string;
  pickup_location_id?: string;
};

export function DriverForm({ carried }: { carried: CarriedParams }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    driver_name: "", driver_email: "", driver_phone: "",
    driver_dob: "", license_number: "",
    license_expiry: "", license_region: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Object.values(form).every(v => v.trim())) { setError("All fields are required."); return; }

    const params = new URLSearchParams({ ...carried, ...form });
    router.push(`/checkout/extras?${params.toString()}`);
  };

  const inp = "w-full bg-white border border-gray-300 text-navy rounded px-3 py-2 focus:border-gold focus:outline-none";
  const lbl = "block text-xs uppercase tracking-wider text-text-muted-wabs mb-2";

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="driver-form">
      <div>
        <label className={lbl}>Full legal name</label>
        <input required value={form.driver_name} onChange={set("driver_name")} className={inp} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Email</label>
          <input required type="email" value={form.driver_email} onChange={set("driver_email")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Phone</label>
          <input required type="tel" value={form.driver_phone} onChange={set("driver_phone")} className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Date of birth (must be 25+)</label>
        <input required type="date" value={form.driver_dob} onChange={set("driver_dob")} className={inp} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={lbl}>License number</label>
          <input required value={form.license_number} onChange={set("license_number")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Expiry</label>
          <input required type="date" value={form.license_expiry} onChange={set("license_expiry")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Issuing region</label>
          <input required value={form.license_region} onChange={set("license_region")} className={inp} placeholder="e.g. CA, USA" />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Continue to extras
      </Button>
    </form>
  );
}
