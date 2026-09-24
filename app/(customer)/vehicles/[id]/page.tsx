import { notFound } from "next/navigation";
import { getVehicleById } from "@/lib/queries/vehicles";
import { Gallery } from "@/components/customer/vehicles/gallery";
import { SpecsTable } from "@/components/customer/vehicles/specs-table";
import { FeaturesList } from "@/components/customer/vehicles/features-list";
import { PricingCard } from "@/components/customer/vehicles/pricing-card";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getVehicleById(id);
  if (!detail) notFound();

  const { vehicle, images, features, location } = detail;
  const heading = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " " + vehicle.trim : ""}`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-gold text-xs uppercase tracking-[0.3em]">{vehicle.category}</p>
        <h1 className="text-4xl font-bold text-navy mt-1">{heading}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Gallery images={images} alt={heading} />
          {vehicle.description && (
            <div>
              <h3 className="text-lg font-semibold text-navy mb-3">About this vehicle</h3>
              <p className="text-navy leading-relaxed">{vehicle.description}</p>
            </div>
          )}
          <SpecsTable v={vehicle} />
          <FeaturesList features={features} />
        </div>
        <div className="lg:col-span-1">
          <PricingCard v={vehicle} location={location} />
        </div>
      </div>
    </div>
  );
}
