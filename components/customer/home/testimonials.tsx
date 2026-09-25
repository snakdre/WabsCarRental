const REVIEWS = [
  { name: "Marcus H.", quote: "Delivered the Huracán to my hotel exactly on time. Wabs makes rentals feel like concierge service.", vehicle: "Lamborghini Huracán" },
  { name: "Sophia K.", quote: "The Rolls-Royce for our anniversary — impeccable. Return was as easy as arrival.", vehicle: "Rolls-Royce Ghost" },
  { name: "Ethan R.", quote: "I compared five other companies. Wabs won on selection and service. The G 63 was flawless.", vehicle: "Mercedes G 63 AMG" },
];

export function Testimonials() {
  return (
    <section className="bg-navy text-white py-20">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">What they say</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Trusted by the discerning</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-navy-light rounded-lg p-6">
              <p className="text-gold text-3xl leading-none mb-4">&ldquo;</p>
              <p className="text-text-muted-wabs italic mb-6">{r.quote}</p>
              <p className="text-sm font-semibold">{r.name}</p>
              <p className="text-xs text-text-muted-wabs">{r.vehicle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
