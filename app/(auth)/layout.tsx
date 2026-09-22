export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2">
            <span className="text-2xl font-bold tracking-widest text-white uppercase">WABS</span>
            <span className="text-xs font-light tracking-[0.3em] text-gold uppercase">Car Rental</span>
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
