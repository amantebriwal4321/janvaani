"use client";

import { useEffect, useRef } from "react";

export interface RoundCarouselImage {
  src: string;
  label: string;
  place: string;
}

interface RoundCarouselProps {
  images: RoundCarouselImage[];
  imageWidth?: number;
  imageHeight?: number;
  spacing?: number;
  speed?: number;
  direction?: "right" | "left";
  drag?: boolean;
  sensitivity?: number;
  tilt?: number;
  perspective?: number;
  cornerRadius?: number;
  innerDim?: number;
  background?: string;
  style?: React.CSSProperties;
}

export function RoundCarousel({
  images,
  imageWidth = 280,
  imageHeight = 360,
  spacing = 2.4,
  speed = 6,
  direction = "left",
  drag = true,
  sensitivity = 4,
  tilt = -8,
  perspective = 2800,
  cornerRadius = 28,
  innerDim = 3.2,
  background = "transparent",
  style = {},
}: RoundCarouselProps) {
  const items = images.length > 0 ? images : [];
  const count = Math.max(items.length, 1);

  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const rotYRef = useRef(0);
  const velRef = useRef(0);
  const lastRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0 });

  const angle = 360 / count;
  const factor = 1 + spacing * 0.15;
  const radius = (imageWidth * factor) / (2 * Math.tan(Math.PI / count));
  const degPerSec = speed * 6 * (direction === "left" ? -1 : 1);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const apply = () => {
      ring.style.transform = `translateZ(${-radius}px) rotateY(${rotYRef.current}deg)`;
    };
    apply();

    const draw = (now: number) => {
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
      lastRef.current = now;
      const frame = Math.min(dt, 0.1);
      if (!dragRef.current.active) {
        if (Math.abs(velRef.current) > 0.01) {
          rotYRef.current += velRef.current * frame;
          velRef.current *= 0.94;
        } else {
          rotYRef.current += degPerSec * frame;
        }
      }
      apply();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [radius, degPerSec]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drag) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { active: true, x: e.clientX };
    velRef.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const dragState = dragRef.current;
    if (!dragState.active) return;
    const dx = e.clientX - dragState.x;
    dragState.x = e.clientX;
    const kick = 0.28 * sensitivity;
    rotYRef.current += dx * kick;
    velRef.current = dx * kick * 60;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current.active = false;
  };

  return (
    <div
      style={{
        ...style,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background,
        perspective: `${perspective}px`,
        cursor: drag ? "grab" : "default",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ transformStyle: "preserve-3d", transform: `rotateX(${tilt}deg)` }}>
        <div
          ref={ringRef}
          style={{
            position: "relative",
            width: imageWidth,
            height: imageHeight,
            transformStyle: "preserve-3d",
          }}
        >
          {items.map((img, i) => (
            <div
              key={img.src}
              style={{
                position: "absolute",
                inset: 0,
                transform: `rotateY(${i * angle}deg) translateZ(${radius}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              <Face img={img} radius={cornerRadius} flip={false} dim={1} />
              <Face img={img} radius={cornerRadius} flip dim={innerDim / 10} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Face({ img, radius, flip, dim }: { img: RoundCarouselImage; radius: number; flip: boolean; dim: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
        backfaceVisibility: "hidden",
        transform: flip ? "rotateY(180deg)" : undefined,
        filter: dim < 1 ? `brightness(${dim})` : undefined,
        boxShadow: "0 18px 40px rgba(42, 33, 24, 0.28)",
        background: `#2a2118 url(${img.src}) center/cover no-repeat`,
      }}
    >
      {!flip && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-16 text-white">
          <p className="text-base font-semibold leading-tight">{img.label}</p>
          <p className="text-xs text-white/80">{img.place}</p>
        </div>
      )}
    </div>
  );
}
