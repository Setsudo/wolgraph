"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RateMain, SaveRating } from "@/lib/data/ratings";
import { addDays, formatDayLabel } from "@/lib/date";
import { sideOrder } from "@/lib/rate/layout";
import { displayedScore } from "@/lib/rate/score";
import { SAVE_DEBOUNCE_MS, SAVE_FAILED_MESSAGE, TOAST_MS } from "./DayView";
import type { SaveStatus } from "./HourSheet";
import { LifeWheel } from "./LifeWheel";
import { RatingSlider } from "./RatingSlider";
import { useLocalToday } from "./useLocalToday";

export const UNAVAILABLE_NOTICE = "Scores aren't saved yet: the ratings table hasn't been set up.";
const RINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type RateViewProps = {
  /** The day (YYYY-MM-DD) being rated: the browser-local today or an earlier day. */
  day: string;
  mains: RateMain[];
  scores: Record<string, number>;
  previous: Record<string, number>;
  /** False when the ratings table is missing: sliders still move, nothing is sent. */
  available: boolean;
  save: SaveRating;
  /** Defaults to router.push(`/rate?day=${day}`). */
  onNavigate?: (day: string) => void;
};

type Scores = Record<string, number>;

/** "Rate your life" (SPEC §10): one 0-10 slider per main category around the wheel. */
export function RateView({
  day,
  mains,
  scores,
  previous,
  available,
  save,
  onNavigate,
}: RateViewProps) {
  const router = useRouter();
  const today = useLocalToday();
  const goTo = (to: string) => (onNavigate ? onNavigate(to) : router.push(`/rate?day=${to}`));
  const canGoNext = today !== null && day < today;
  const initial = useCallback(
    (id: string) => displayedScore(id, scores, previous),
    [scores, previous],
  );

  /** Values the user moved; every other category shows its displayed score. */
  const [moved, setMoved] = useState<Scores>({});
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [toastId, setToastId] = useState(0);

  /** Last value the server accepted per category (rollback target). */
  const saved = useRef<Scores>({});
  /** Latest edit per category, and the latest edit whose save has finished. Unequal = unsettled. */
  const versions = useRef<Record<string, number>>({});
  const settled = useRef<Record<string, number>>({});
  const pending = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; value: number; version: number }>(),
  );
  const saveRef = useRef(save);
  const freshRef = useRef({ scores, previous });

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const send = useCallback(
    async (categoryId: string, value: number, version: number) => {
      let ok = false;
      try {
        ok = (await saveRef.current(categoryId, day, value)).ok;
      } catch {
        ok = false;
      }
      const latest = versions.current[categoryId] === version;
      if (ok) {
        saved.current = { ...saved.current, [categoryId]: value };
        if (latest) {
          settled.current[categoryId] = version;
          setStatus((s) => ({ ...s, [categoryId]: "saved" }));
        }
      } else if (latest) {
        // Only roll back when no newer change is waiting; a newer save decides the outcome.
        settled.current[categoryId] = version;
        const back = saved.current[categoryId];
        setMoved((m) => {
          const next = { ...m };
          if (back === undefined) delete next[categoryId];
          else next[categoryId] = back;
          return next;
        });
        setStatus((s) => ({ ...s, [categoryId]: null }));
        setToastId((id) => id + 1);
      }
    },
    [day],
  );

  // Fresh server data (saveRating revalidates /rate): settled categories show the server's
  // value again; categories with a debounced or in-flight change keep their local value.
  useEffect(() => {
    const fresh = freshRef.current;
    if (fresh.scores === scores && fresh.previous === previous) return;
    freshRef.current = { scores, previous };
    const unsettled = (id: string) => (versions.current[id] ?? 0) !== (settled.current[id] ?? 0);
    const keep = (local: Scores) =>
      Object.fromEntries(Object.entries(local).filter(([id]) => unsettled(id)));
    saved.current = keep(saved.current);
    setMoved((m) => keep(m));
  }, [scores, previous]);

  // On unmount, send any change still waiting on its debounce instead of dropping it.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const [categoryId, { timer, value, version }] of waiting) {
        clearTimeout(timer);
        void send(categoryId, value, version);
      }
      waiting.clear();
    };
  }, [send]);

  useEffect(() => {
    if (!toastId) return;
    const timer = setTimeout(() => setToastId(0), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastId]);

  const valueOf = (id: string) => moved[id] ?? initial(id);

  function change(categoryId: string, value: number) {
    if (!(categoryId in saved.current)) saved.current[categoryId] = initial(categoryId);
    setMoved((m) => ({ ...m, [categoryId]: value }));
    if (!available) return;
    const version = (versions.current[categoryId] ?? 0) + 1;
    versions.current[categoryId] = version;
    setStatus((s) => ({ ...s, [categoryId]: "saving" }));
    const waiting = pending.current.get(categoryId);
    if (waiting) clearTimeout(waiting.timer);
    const timer = setTimeout(() => {
      pending.current.delete(categoryId);
      void send(categoryId, value, version);
    }, SAVE_DEBOUNCE_MS);
    pending.current.set(categoryId, { timer, value, version });
  }

  const slider = (i: number) => {
    const m = mains[i];
    return (
      <RatingSlider
        key={m.id}
        label={m.name}
        value={valueOf(m.id)}
        color={m.color}
        status={status[m.id] ?? null}
        onChange={(v) => change(m.id, v)}
      />
    );
  };

  const values = mains.map((m) => valueOf(m.id));
  const { left, right } = sideOrder(mains.length);
  const side = "hidden md:flex md:flex-col md:self-stretch";
  // Spacers keep the first and last slider level with the wheel's label band.
  const spacer = <div aria-hidden="true" className="shrink-0 basis-[6%]" />;
  // Same day arrows as the Day screen.
  const navButton =
    "flex h-11 w-11 items-center justify-center rounded-lg text-[24px] disabled:opacity-30";

  return (
    <div className="mx-auto w-full max-w-[1240px] text-navy">
      <h1 className="text-center font-display text-[28px] font-normal tracking-[0.12em] uppercase md:text-[44px]">
        Wheel of Life
      </h1>
      <div className="mt-1 flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label="Previous day"
          className={navButton}
          onClick={() => goTo(addDays(day, -1))}
        >
          ‹
        </button>
        <span className="flex h-11 items-center px-2 font-display text-[20px]">
          {formatDayLabel(day)}
        </span>
        <button
          type="button"
          aria-label="Next day"
          className={navButton}
          disabled={!canGoNext}
          onClick={() => goTo(addDays(day, 1))}
        >
          ›
        </button>
      </div>
      {!available && (
        <p className="mt-2 text-center text-[14px] text-amber">{UNAVAILABLE_NOTICE}</p>
      )}

      <div className="mt-4 md:grid md:grid-cols-[1fr_2fr_1fr] md:items-center md:gap-10 lg:grid-cols-[1fr_2.5fr_1fr] lg:gap-8">
        <div data-testid="rate-left" className={side}>
          {spacer}
          <div className="flex flex-1 flex-col justify-between gap-6">{left.map(slider)}</div>
          {spacer}
        </div>
        <div className="min-w-0">
          <LifeWheel
            labels={mains.map((m) => m.name)}
            colors={mains.map((m) => m.color)}
            values={values}
            max={10}
            maxWidthClass="max-w-[720px]"
            rings={RINGS}
            ringLabel={(v) => String(v)}
            ariaLabel={"Life ratings: " + mains.map((m, i) => `${m.name} ${values[i]}`).join(", ")}
          />
        </div>
        <div data-testid="rate-right" className={side}>
          {spacer}
          <div className="flex flex-1 flex-col justify-between gap-6">{right.map(slider)}</div>
          {spacer}
        </div>
      </div>

      {/* Phones: every slider below the wheel, in category order. */}
      <div data-testid="rate-list" className="mt-6 flex flex-col gap-6 md:hidden">
        {mains.map((_, i) => slider(i))}
      </div>

      {toastId > 0 && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-amber px-4 py-2 text-[14px] whitespace-nowrap text-cream"
        >
          {SAVE_FAILED_MESSAGE}
        </div>
      )}
    </div>
  );
}
