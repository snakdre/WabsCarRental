import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  getManagementVehicleById, listVehicleImages, listVehicleBookings,
} from "@/lib/queries/management-vehicles";
import { VehicleEditForm } from "@/components/management/vehicles/vehicle-edit-form";
import { ImageManager } from "@/components/management/vehicles/image-manager";
import { DuplicateVehicleButton } from "@/components/management/vehicles/duplicate-vehicle-button";
import { VehicleBookingHistory } from "@/components/management/vehicles/vehicle-booking-history";

export const dynamic = "force-dynamic";

export default async function ManagementVehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getManagementVehicleById(id);
  if (!detail) notFound();
  const [images, bookings] = await Promise.all([listVehicleImages(id), listVehicleBookings(id)]);

  const title = `${detail.year} ${detail.make} ${detail.model}${detail.trim ? " " + detail.trim : ""}`;

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link
        href="/management/vehicles"
        className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to vehicles
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">{detail.category}</p>
          <h1 className="text-3xl font-bold text-navy">{title}</h1>
        </div>
        <DuplicateVehicleButton vehicleId={detail.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <VehicleEditForm vehicle={detail} />
        <ImageManager vehicleId={detail.id} images={images} />
      </div>

      <div className="mt-8">
        <VehicleBookingHistory bookings={bookings} />
      </div>
    </main>
  );
}
