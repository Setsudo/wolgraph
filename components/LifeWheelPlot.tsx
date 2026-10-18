"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { roundCoord, valuedPath, valuedPoints } from "@/lib/lifewheel/geometry";
import {
  retarget,
  sample,
  settled,
  settledMotions,
  type Motion,
  type Shown,
} from "@/lib/lifewheel/motion";

// Runs before paint in the browser, so a new animation's first frame replaces
// the final state before it is ever shown; plain effect on the server.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Animate only in a browser with rAF and matchMedia, and never with reduced motion. */
function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.requestAnimationFrame !== "function") return false;
  if (typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type LifeWheelPlotProps = {
  size: number;
  /** Value radius per sector in viewBox units; null = no value (no dot, skipped by the shape). */
  radii: (number | null)[];
  colors?: string[];
  /** Static dashed outline above the grid, below the outline and dots; never animated or hidden while pending. */
  ghostPath?: string;
  ariaLabel: string;
  className: string;
  /** Drawn first (label arcs). */
  defs: ReactNode;
  /** Rings, spokes and boundary: between the fill and the outline. */
  grid: ReactNode;
  /** Ring and category labels, on top. */
  overlay: ReactNode;
};

/**
 * The life wheel's SVG with its value shape and dots, animated on the client:
 * points pop in, glide on change and retract when they lose their value
 * (lib/lifewheel/motion). Server render, no-JS and reduced motion draw the
 * final state.
 */
export function LifeWheelPlot({
  size,
  radii,
  colors,
  ghostPath,
  ariaLabel,
  className,
  defs,
  grid,
  overlay,
}: LifeWheelPlotProps) {
  // null = at rest: draw the targets straight from props (identical on server and client).
  const [frame, setFrame] = useState<Shown[] | null>(null);
  // Server and first client render mark the data layer pending; with the
  // motion flag on <html> (app/layout.tsx) CSS hides it until the pop-in starts.
  const [pending, setPending] = useState(true);
  const motions = useRef<Motion[] | null>(null);
  const n = radii.length;
  // Value-equal radii keep the effect quiet across unrelated re-renders.
  const key = JSON.stringify(radii);

  useIsoLayoutEffect(() => {
    const targets = JSON.parse(key) as (number | null)[];
    const count = targets.length;
    if (!canAnimate()) {
      motions.current = settledMotions(targets);
      // Before paint: reveal the final state at once.
      setPending(false);
      return;
    }
    const first = motions.current === null;
    let raf = 0;
    const tick = (now: number) => {
      const s = sample(motions.current ?? [], now, count, size);
      motions.current = s.motions;
      flushSync(() => {
        setFrame(s.done ? null : s.shown);
        setPending(false);
      });
      raf = s.done ? 0 : window.requestAnimationFrame(tick);
    };
    motions.current = retarget(motions.current ?? [], targets, performance.now(), first, size);
    raf = window.requestAnimationFrame(tick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [key, size]);

  const shown = frame ?? settled(radii);
  const scaleOf = new Map(shown.map((s) => [s.index, s.scale]));
  const at: (number | null)[] = Array.from({ length: n }, () => null);
  for (const s of shown) if (s.index < n) at[s.index] = s.r;
  const pts = valuedPoints(at, size);
  const path = valuedPath(pts);
  const dataLayer = { "data-lifewheel-data": "", "data-pending": pending ? "" : undefined };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className={className}>
      <defs>{defs}</defs>
      {/* Fill under the grid so grid lines stay readable through it. */}
      <g {...dataLayer}>
        {path && <path data-part="data" d={path} className="fill-teal" fillOpacity={0.4} />}
      </g>
      {grid}
      {ghostPath && (
        <path
          data-part="ghost"
          aria-hidden="true"
          d={ghostPath}
          // The SVG scales with the screen, so on phones (under 768px) the line gets thicker,
          // longer dashes and more contrast; from 768px the attributes below apply as is.
          className="fill-none stroke-navy/60 [stroke-dasharray:10_6] [stroke-width:4] md:stroke-navy/35 md:[stroke-dasharray:4_4] md:[stroke-width:1.5]"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinejoin="round"
        />
      )}
      {/* Outline and dots above the grid, as in the reference. */}
      <g {...dataLayer}>
        {path && (
          <path
            data-part="data-outline"
            d={path}
            className="fill-none stroke-teal"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {pts.map(({ index, ...raw }) => {
          const p = { index, x: roundCoord(raw.x), y: roundCoord(raw.y) };
          const color = colors?.[p.index];
          const s = scaleOf.get(p.index) ?? 1;
          // Scale about the dot's own centre.
          const transform =
            s === 1 ? undefined : `translate(${p.x} ${p.y}) scale(${s}) translate(${-p.x} ${-p.y})`;
          return color ? (
            <circle
              key={p.index}
              data-part="dot"
              data-index={p.index}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={color}
              className="stroke-cream"
              strokeWidth={1.5}
              transform={transform}
            />
          ) : (
            <circle
              key={p.index}
              data-part="dot"
              data-index={p.index}
              cx={p.x}
              cy={p.y}
              r={4}
              className="fill-teal"
              transform={transform}
            />
          );
        })}
      </g>
      {overlay}
    </svg>
  );
}
