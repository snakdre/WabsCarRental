"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Img = { url: string; alt_text: string | null };

export function Gallery({ images, alt }: { images: Img[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-[16/10] rounded-lg bg-gradient-to-br from-navy to-navy-light" />;
  }
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  const active = images[idx];

  return (
    <div>
      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-gradient-to-br from-navy to-navy-light">
        <Image
          src={active.url}
          alt={active.alt_text ?? alt}
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
          priority={idx === 0}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-navy rounded-full p-2"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-navy rounded-full p-2"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`relative w-20 h-16 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                i === idx ? "border-gold" : "border-transparent"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
