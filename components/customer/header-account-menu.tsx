"use client";

import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function HeaderAccountMenu({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="rounded-full w-10 h-10 p-0 bg-gold text-deep font-semibold hover:bg-gold-muted" data-testid="account-menu-trigger">
          {initial}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-navy border-navy-light text-white">
        <DropdownMenuLabel className="text-text-muted-wabs text-xs font-normal">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-navy-light" />
        <DropdownMenuItem asChild className="focus:bg-navy-light focus:text-gold">
          <Link href="/account">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-navy-light" />
        <form action={signOut}>
          <button type="submit" className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-navy-light hover:text-gold">
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
