import Link from "next/link";

export function CustomerFooter() {
  return (
    <footer className="bg-deep text-white mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl font-bold tracking-widest uppercase">WABS</span>
            <span className="text-xs tracking-[0.3em] text-gold uppercase">Car Rental</span>
          </div>
          <p className="text-text-muted-wabs text-sm">Premium luxury car rentals for those who demand exceptional.</p>
        </div>
        <div>
          <h4 className="text-gold text-sm font-semibold uppercase tracking-wider mb-3">Fleet</h4>
          <ul className="space-y-2 text-sm text-text-muted-wabs">
            <li><Link href="/vehicles?category=exotic" className="hover:text-gold">Exotic</Link></li>
            <li><Link href="/vehicles?category=sports" className="hover:text-gold">Sports</Link></li>
            <li><Link href="/vehicles?category=suv" className="hover:text-gold">SUV</Link></li>
            <li><Link href="/vehicles?category=electric" className="hover:text-gold">Electric</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-gold text-sm font-semibold uppercase tracking-wider mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-text-muted-wabs">
            <li><Link href="/" className="hover:text-gold">About</Link></li>
            <li><Link href="/" className="hover:text-gold">Locations</Link></li>
            <li><Link href="/" className="hover:text-gold">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-gold text-sm font-semibold uppercase tracking-wider mb-3">Contact</h4>
          <ul className="space-y-2 text-sm text-text-muted-wabs">
            <li>hello@wabscarrental.com</li>
            <li>+1 (555) 000-0000</li>
            <li>Beverly Hills · Malibu · LAX</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-light">
        <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-text-muted-wabs">
          © 2026 Wabs Car Rental. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
