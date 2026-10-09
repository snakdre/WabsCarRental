import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { VehicleCreateForm } from "@/components/management/vehicles/vehicle-create-form";

export default function NewVehiclePage() {
  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link
        href="/management/vehicles"
        className="inline-flex items-center gap-1 text-sm text-gold hover:underline mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to vehicles
      </Link>

      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">New vehicle</h1>
      </div>

      <VehicleCreateForm />
    </main>
  );
}
