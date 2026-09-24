const STEPS = [
  { n: "01", title: "Choose your vehicle", body: "Browse our fleet or filter by category, budget, or occasion." },
  { n: "02", title: "Reserve your dates", body: "Pick your pickup date and location, delivery to your door available." },
  { n: "03", title: "Drive the extraordinary", body: "Meet your vehicle at Beverly Hills, Malibu, or LAX — or we come to you." },
];

export function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">How it works</p>
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Simple, from search to seat</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {STEPS.map((s) => (
          <div key={s.n} className="text-center md:text-left">
            <p className="text-gold text-4xl font-bold mb-4">{s.n}</p>
            <h3 className="text-xl font-semibold text-navy mb-2">{s.title}</h3>
            <p className="text-text-muted-wabs">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
