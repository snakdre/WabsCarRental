import Link from "next/link";

const CATEGORY_TILES = [
  { key: "exotic", label: "Exotic", tagline: "Ferrari, Lamborghini, McLaren" },
  { key: "sports", label: "Sports", tagline: "Porsche, BMW, Aston Martin" },
  { key: "suv", label: "SUV", tagline: "Range Rover, G-Wagen, Escalade" },
  { key: "convertible", label: "Convertible", tagline: "Open air, uncompromised" },
  { key: "executive", label: "Executive", tagline: "Rolls-Royce, Bentley" },
  { key: "electric", label: "Electric", tagline: "Tesla and the future" },
];

export function Categories() {
  return (
    <section className="bg-navy text-white py-20">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">Browse by category</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Every occasion, matched</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORY_TILES.map((c) => (
            <Link
              key={c.key}
              href={`/vehicles?category=${c.key}`}
              className="group block bg-navy-light border border-navy-light hover:border-gold rounded-lg p-8 transition-all duration-200"
            >
              <h3 className="text-xl font-semibold group-hover:text-gold transition-colors">{c.label}</h3>
              <p className="text-sm text-text-muted-wabs mt-2">{c.tagline}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
