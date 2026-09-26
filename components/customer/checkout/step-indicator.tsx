const STEPS = ["Dates", "Driver", "Extras", "Review", "Payment", "Done"];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 py-6">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isActive = n === current;
        const isDone = n < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                isActive ? "bg-gold text-deep" :
                isDone ? "bg-gold/40 text-deep" :
                "bg-white border border-gray-300 text-text-muted-wabs"
              }`}
            >{n}</span>
            <span className={`text-xs hidden sm:inline ${isActive ? "text-navy font-semibold" : "text-text-muted-wabs"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-gray-300" />}
          </li>
        );
      })}
    </ol>
  );
}
