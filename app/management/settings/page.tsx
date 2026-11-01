import { redirect } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/utils/roles";
import { listSettingsForAdmin } from "@/lib/queries/settings";
import { SettingsForm } from "@/components/management/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Middleware already blocks non-admins; re-check here (defence in depth).
  if (!isAdmin(await getUserRole())) redirect("/management");
  const rows = await listSettingsForAdmin();

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">Settings</h1>
        <p className="text-text-muted-wabs mt-2">
          Changes apply immediately to new bookings. Existing bookings keep the prices they were created with.
        </p>
      </div>
      <SettingsForm rows={rows} />
    </main>
  );
}
