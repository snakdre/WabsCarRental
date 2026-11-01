"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/lib/actions/account";
import type { MyProfile } from "@/lib/queries/account";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

function Field({
  name, label, defaultValue, type = "text", error, autoComplete,
}: {
  name: string; label: string; defaultValue: string | null | undefined; type?: string; error?: boolean; autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted-wabs mb-1">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        autoComplete={autoComplete}
        aria-invalid={error || undefined}
        className={`${inputCls} ${error ? "border-red-500" : ""}`}
      />
    </label>
  );
}

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setStatus("idle");
    startTransition(async () => {
      const res = await updateProfile(fd);
      if (res?.error) { setStatus("error"); setError({ message: res.error, field: res.field }); }
      else setStatus("saved");
    });
  };

  const a = profile.address ?? {};
  const bad = (f: string) => error?.field === f;

  return (
    <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-6" data-testid="profile-form">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted-wabs mb-1">Email</p>
        <p className="text-navy">{profile.email}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field name="first_name" label="First name" defaultValue={profile.first_name} error={bad("first_name")} autoComplete="given-name" />
        <Field name="last_name" label="Last name" defaultValue={profile.last_name} error={bad("last_name")} autoComplete="family-name" />
        <Field name="phone" label="Phone" type="tel" defaultValue={profile.phone} error={bad("phone")} autoComplete="tel" />
        <Field name="date_of_birth" label="Date of birth" type="date" defaultValue={profile.date_of_birth} error={bad("date_of_birth")} autoComplete="bday" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-4">
          <Field name="address_line1" label="Street address" defaultValue={a.line1} error={bad("address_line1")} autoComplete="address-line1" />
        </div>
        <div className="md:col-span-2">
          <Field name="address_city" label="City" defaultValue={a.city} error={bad("address_city")} autoComplete="address-level2" />
        </div>
        <Field name="address_state" label="State" defaultValue={a.state} error={bad("address_state")} autoComplete="address-level1" />
        <Field name="address_zip" label="ZIP" defaultValue={a.zip} error={bad("address_zip")} autoComplete="postal-code" />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Saving…" : "Save profile"}
        </Button>
        {status === "saved" && <span className="text-green-700 text-sm">Saved</span>}
        {status === "error" && <span className="text-red-600 text-sm">{error?.message}</span>}
      </div>
    </form>
  );
}
