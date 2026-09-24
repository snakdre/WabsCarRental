import { Check } from "lucide-react";

export function FeaturesList({ features }: { features: string[] }) {
  if (features.length === 0) return null;
  return (
    <div>
      <h3 className="text-lg font-semibold text-navy mb-3">Features</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-navy">
            <Check className="w-4 h-4 text-gold flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
