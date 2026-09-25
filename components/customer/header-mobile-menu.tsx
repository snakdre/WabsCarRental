"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function HeaderMobileMenu({ authed }: { authed: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-navy-light">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-navy border-navy-light text-white">
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/vehicles" className="text-lg hover:text-gold">Fleet</Link>
          <Link href="/" className="text-lg hover:text-gold">How It Works</Link>
          <Link href="/" className="text-lg hover:text-gold">About</Link>
          {!authed && (
            <>
              <Link href="/login" className="text-lg text-gold">Sign In</Link>
              <Link href="/register" className="text-lg hover:text-gold">Register</Link>
            </>
          )}
          {authed && (
            <Link href="/account" className="text-lg text-gold">Account</Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
