export function KpiTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-text-muted-wabs text-xs uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-navy mt-2">{value}</p>
      {hint && <p className="text-xs text-text-muted-wabs mt-1">{hint}</p>}
    </div>
  );
}
