import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getManagementVehicleById } from "@/lib/queries/management-vehicles";
import { VehicleEditForm } from "@/components/management/vehicles/vehicle-edit-form";

export const dynamic = "force-dynamic";

export default async function ManagementVehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getManagementVehicleById(id);
  if (!detail) notFound();

  const title = `${detail.year} ${detail.make} ${detail.model}${detail.trim ? " " + detail.trim : ""}`;

  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link
        href="/management/vehicles"
        className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to vehicles
      </Link>

      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">{detail.category}</p>
        <h1 className="text-3xl font-bold text-navy">{title}</h1>
      </div>

      <VehicleEditForm vehicle={detail} />
    </main>
  );
}
