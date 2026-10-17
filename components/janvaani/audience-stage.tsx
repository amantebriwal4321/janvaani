"use client";

import { useEffect, useState } from "react";
import { RoundCarousel, type RoundCarouselImage } from "./round-carousel";

const PEOPLE: RoundCarouselImage[] = [
  { src: "/audience/widow-farmer.jpg", label: "She already knows her story", place: "A widow, at her own door" },
  { src: "/audience/village-face.jpg", label: "The village, on a bicycle", place: "India" },
  { src: "/audience/spiti-mother.jpg", label: "A mother, and the next name on the card", place: "Spiti, Himachal" },
  { src: "/audience/tailor-bhura-singh.jpg", label: "Bhura Singh, tailor", place: "Rampura, Punjab" },
  { src: "/audience/elderly-weaver-assam.jpg", label: "Silk, still on the loom", place: "Sualkuchi, Assam" },
  { src: "/audience/women-sowing-karnataka.jpg", label: "Sowing the season", place: "Devadurga, Karnataka" },
  { src: "/audience/cotton-raichur.jpg", label: "Cotton, paid by the kilo", place: "Raichur, Karnataka" },
  { src: "/audience/rice-harvest-raichur.jpg", label: "Harvest, by hand", place: "Raichur, Karnataka" },
];

const OPEN_MS = 7000;

export function AudienceStage({ onEnter, autoOpen }: { onEnter: () => void; autoOpen: boolean }) {
  const [width, setWidth] = useState(240);

  useEffect(() => {
    const fit = () => setWidth(Math.round(Math.min(250, Math.max(168, window.innerWidth * 0.22))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(onEnter, OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [autoOpen, onEnter]);

  return (
    <section className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#f3eee4] text-[#2a2118]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.7),transparent_55%)]" />

      <div className="relative z-10 px-6 text-center">
        <p className="text-xs font-medium tracking-[0.28em] text-[#8c3b24] uppercase">JanVaani · जनवाणी</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">घर की भाषा काफी है।</h1>
        <p className="mt-2 text-base text-[#5c5146] md:text-lg">Your own language is enough.</p>
      </div>

      <div className="relative z-10 h-[min(58dvh,520px)] w-full">
        <RoundCarousel
          images={PEOPLE}
          imageWidth={width}
          imageHeight={Math.round(width * 1.3)}
          speed={11}
          spacing={2.2}
          background="transparent"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-2">
        <button
          type="button"
          onClick={onEnter}
          className="rounded-full bg-[#8c3b24] px-6 py-3 text-base font-medium text-white shadow-lg transition hover:bg-[#732f1c]"
        >
          Open the desk
        </button>
        {autoOpen && (
          <div className="h-1 w-40 overflow-hidden rounded-full bg-[#2a2118]/10">
            <div className="h-full bg-[#8c3b24]" style={{ animation: `grow ${OPEN_MS}ms linear forwards` }} />
          </div>
        )}
        <p className="max-w-md text-center text-[11px] text-[#5c5146]">Real photographs. Drag the ring, or wait. The desk opens on its own.</p>
      </div>
      <style>{`@keyframes grow { from { width: 0 } to { width: 100% } }`}</style>
    </section>
  );
}
