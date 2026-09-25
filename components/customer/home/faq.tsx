"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "What's the minimum driver age?", a: "You must be at least 25 years old with a valid driver's license and clean record to rent from Wabs." },
  { q: "Is insurance included?", a: "Basic collision coverage is available; premium and elite tiers add lower deductibles and full coverage. Selected at checkout." },
  { q: "Can you deliver the vehicle?", a: "Yes, delivery is available at select locations (Beverly Hills, Malibu, LAX). Fees vary by vehicle." },
  { q: "What if I go over the mileage limit?", a: "Each vehicle has a daily mileage limit. Overage fees are shown on the vehicle page and applied at return." },
  { q: "Can I cancel my booking?", a: "Cancellations up to 48 hours before pickup are fully refundable. Later cancellations incur a fee based on the cancellation policy." },
];

export function Faq() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20">
      <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2 text-center">Common questions</p>
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Answers, upfront</h2>
      <Accordion type="single" collapsible className="space-y-2">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="bg-white rounded-lg border border-gray-200 px-6">
            <AccordionTrigger className="text-navy font-semibold hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="text-text-muted-wabs">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
