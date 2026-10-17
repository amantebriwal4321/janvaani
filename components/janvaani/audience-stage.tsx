"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoundCarousel, type RoundCarouselImage } from "./round-carousel";

const PEOPLE: RoundCarouselImage[] = [
  { src: "/audience/rice-harvest-raichur.jpg", label: "Harvest, by hand", place: "Raichur, Karnataka" },
  { src: "/audience/women-sowing-karnataka.jpg", label: "Sowing the season", place: "Devadurga, Karnataka" },
  { src: "/audience/cotton-raichur.jpg", label: "Cotton, paid by the kilo", place: "Raichur, Karnataka" },
  { src: "/audience/farmers-dharwad.jpg", label: "The field beside the highway", place: "Dharwad, Karnataka" },
  { src: "/audience/tailor-bhura-singh.jpg", label: "Bhura Singh, tailor", place: "Rampura, Punjab" },
  { src: "/audience/elderly-weaver-assam.jpg", label: "Silk, still on the loom", place: "Sualkuchi, Assam" },
  { src: "/audience/village-cook-ranpur.jpg", label: "The kitchen is the workplace", place: "Ranpur" },
  { src: "/audience/elderly-kibber.jpg", label: "A day between shifts", place: "Kibber, Himachal" },
];

const LANGUAGES = ["हिन्दी", "ಕನ್ನಡ", "ਪੰਜਾਬੀ", "भोजपुरी", "অসমীয়া", "తెలుగు", "தமிழ்", "मराठी", "English"];

export function AudienceStage({ onEnter }: { onEnter: () => void }) {
  const [width, setWidth] = useState(280);

  useEffect(() => {
    const fit = () => {
      const next = Math.round(Math.min(300, Math.max(200, window.innerWidth * 0.34)));
      setWidth(next);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f3eee4] text-[#2a2118]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(243,238,228,0.2)_42%,#f3eee4_78%)]" />
      <header className="relative z-10 flex items-end justify-between px-5 pt-5 md:px-10">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-[#8c3b24] uppercase">JanVaani · जनवाणी</p>
          <h1 className="mt-1 max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">The form is in English. Her story is not.</h1>
        </div>
        <p className="hidden max-w-xs text-right text-sm text-[#5c5146] md:block">Drag the ring. These are the people the desk is for.</p>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        <RoundCarousel images={PEOPLE} imageWidth={width} imageHeight={Math.round(width * 1.28)} background="transparent" />
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-4 px-5 pb-6 md:pb-8">
        <div className="flex max-w-3xl flex-wrap justify-center gap-2">
          {LANGUAGES.map((language) => (
            <span key={language} className="rounded-full border border-[#2a2118]/15 bg-white/70 px-3 py-1 text-sm">
              {language}
            </span>
          ))}
        </div>
        <Button size="lg" className="h-12 rounded-full px-6 text-base" onClick={onEnter}>
          Open the desk
          <ArrowRight data-icon="inline-end" />
        </Button>
        <p className="text-center text-[11px] text-[#5c5146]">Photographs by the people credited in pitch/CREDITS.txt. Used under their Creative Commons licences.</p>
      </footer>
    </section>
  );
}
