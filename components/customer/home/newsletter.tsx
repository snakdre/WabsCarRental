"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "You're on the list", description: `We'll send exclusive fleet updates to ${email}.` });
    setEmail("");
  };

  return (
    <section className="bg-deep text-white py-20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Stay in the fast lane</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">First to know, first to drive</h2>
        <p className="text-text-muted-wabs mb-8">Fleet updates, seasonal offers, and preview access to new arrivals.</p>
        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 bg-navy-light border border-navy-light text-white placeholder:text-text-muted-wabs rounded px-4 py-3 focus:border-gold focus:outline-none"
          />
          <Button type="submit" className="bg-gold hover:bg-gold-muted text-deep font-semibold px-8">
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
}
