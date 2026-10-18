"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CopyPreviousDay, DayCategory, DayEntry, SaveEntry } from "@/lib/data/day";
import { addDays, formatDayLabel, isValidDay } from "@/lib/date";
import {
  canOfferCopy,
  copiedMessage,
  copyLabel,
  copyPlan,
  previousDayName,
  type CopiedEntry,
} from "@/lib/day/copy";
import { archivedSubParents, buildWheel, dayTotal, mainPanel } from "@/lib/wheel/model";
import { HourSheet, type SaveStatus } from "./HourSheet";
import { useLocalToday } from "./useLocalToday";
import { Wheel } from "./Wheel";

export const SAVE_DEBOUNCE_MS = 400;
export const TOAST_MS = 4000;
export const SAVE_FAILED_MESSAGE = "Couldn't save. Your change was undone.";
export const COPY_FAILED_MESSAGE = "Couldn't copy. Nothing changed.";
export const COPY_NOTICE_MS = 6000;
const TOAST_BASE =
  "left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[14px] whitespace-nowrap text-cream";
const TOAST_CLASS = `${TOAST_BASE} bg-amber`;

type DayViewProps = {
  date: string;
  categories: DayCategory[];
  entries: DayEntry[];
  save: SaveEntry;
  /** The previous day's copyable entries (getDay's `previous`). */
  previous?: DayEntry[];
  /** Copies the previous day onto this one; without it the copy button never shows. */
  copy?: CopyPreviousDay;
  /** Defaults to router.push(`/day/${day}`). */
  onNavigate?: (day: string) => void;
};

type Hours = Record<string, number>;

function toHours(entries: DayEntry[]): Hours {
  const out: Hours = {};
  for (const e of entries) if (e.hours > 0) out[e.categoryId] = e.hours;
  return out;
}

function withValue(hours: Hours, categoryId: string, value: number): Hours {
  const next = { ...hours };
  if (value > 0) next[categoryId] = value;
  else delete next[categoryId];
  return next;
}

/** Daily entry screen (SPEC §6.2): day navigation, wheel, hour sheet and optimistic saving. */
export function DayView({
  date,
  categories,
  entries,
  save,
  previous = [],
  copy,
  onNavigate,
}: DayViewProps) {
  const router = useRouter();
  const today = useLocalToday();
  const goTo = (day: string) => (onNavigate ? onNavigate(day) : router.push(`/day/${day}`));

  const future = today !== null && date > today;
  const readOnly = today === null || date > today;
  const canGoNext = today !== null && date < today;

  const [hours, setHours] = useState<Hours>(() => toHours(entries));
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Panel row that quick add and Clear target; null = General (the main's own row). */
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [toastId, setToastId] = useState(0);
  const [copying, setCopying] = useState(false);
  /** Outcome of the last copy: the entries written (with Undo), or a failure. */
  const [copyNotice, setCopyNotice] = useState<
    { kind: "copied"; entries: CopiedEntry[] } | { kind: "failed" } | null
  >(null);

  const saved = useRef<Hours>(toHours(entries));
  /** Latest edit per category, and the latest edit whose save has finished. Unequal = unsettled. */
  const versions = useRef<Record<string, number>>({});
  const settled = useRef<Record<string, number>>({});
  const pending = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; value: number; version: number }>(),
  );
  const saveRef = useRef(save);
  const entriesRef = useRef(entries);
  const wheelRef = useRef<SVGSVGElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const archivedParents = useMemo(
    () => archivedSubParents(categories, entries),
    [categories, entries],
  );
  const segments = useMemo(
    () => buildWheel(categories, hours, archivedParents),
    [categories, hours, archivedParents],
  );
  const plan = useMemo(() => copyPlan(categories, previous), [categories, previous]);
  const offerCopy =
    copy !== undefined &&
    !copying &&
    canOfferCopy({
      readOnly,
      dayTotal: dayTotal(hours),
      unsettled: Object.values(status).includes("saving"),
      copyable: plan.entries.length,
    });
  const selected = segments.find((s) => s.key === selectedKey) ?? null;
  const panel = selected ? mainPanel(segments, selected.mainId) : null;

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const send = useCallback(
    async (categoryId: string, value: number, version: number) => {
      let ok = false;
      try {
        ok = (await saveRef.current(date, categoryId, value)).ok;
      } catch {
        ok = false;
      }
      const latest = versions.current[categoryId] === version;
      if (ok) {
        saved.current = withValue(saved.current, categoryId, value);
        if (latest) {
          settled.current[categoryId] = version;
          setStatus((s) => ({ ...s, [categoryId]: "saved" }));
        }
      } else if (latest) {
        // Only roll back when no newer change is waiting; a newer save decides the outcome.
        settled.current[categoryId] = version;
        const previous = saved.current[categoryId] ?? 0;
        setHours((h) => withValue(h, categoryId, previous));
        setStatus((s) => ({ ...s, [categoryId]: null }));
        setToastId((id) => id + 1);
      }
    },
    [date],
  );

  // Fresh server data (saveEntry revalidates this path, so the route re-renders with new
  // entries): adopt it for every category with no unsettled edit. Categories with a
  // debounced or in-flight change keep their optimistic value.
  useEffect(() => {
    if (entries === entriesRef.current) return;
    entriesRef.current = entries;
    const fresh = toHours(entries);
    const unsettled = (id: string) => (versions.current[id] ?? 0) !== (settled.current[id] ?? 0);
    const merge = (local: Hours) => {
      const next: Hours = {};
      for (const id of new Set([...Object.keys(fresh), ...Object.keys(local)])) {
        const value = unsettled(id) ? (local[id] ?? 0) : (fresh[id] ?? 0);
        if (value > 0) next[id] = value;
      }
      return next;
    };
    saved.current = merge(saved.current);
    setHours((h) => merge(h));
  }, [entries]);

  // When the screen is hidden or unmounted (navigating to another day), send any change
  // still waiting on its debounce instead of dropping it.
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

  useEffect(() => {
    if (!copyNotice) return;
    const timer = setTimeout(() => setCopyNotice(null), COPY_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [copyNotice]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    if (sheetRef.current?.contains(document.activeElement)) wheelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  function change(categoryId: string, value: number) {
    if (readOnly) return;
    const version = (versions.current[categoryId] ?? 0) + 1;
    versions.current[categoryId] = version;
    setHours((h) => withValue(h, categoryId, value));
    setStatus((s) => ({ ...s, [categoryId]: "saving" }));
    const waiting = pending.current.get(categoryId);
    if (waiting) clearTimeout(waiting.timer);
    const timer = setTimeout(() => {
      pending.current.delete(categoryId);
      void send(categoryId, value, version);
    }, SAVE_DEBOUNCE_MS);
    pending.current.set(categoryId, { timer, value, version });
  }

  /** Explicit "copy previous day" tap: writes on the server, then shows what was copied. */
  async function copyPrevious() {
    if (!copy || copying || readOnly) return;
    setCopying(true);
    setCopyNotice(null);
    let copied: CopiedEntry[] | null = null;
    try {
      const result = await copy(date);
      if (result.ok) copied = result.copied;
    } catch {
      copied = null;
    }
    setCopying(false);
    if (!copied) {
      setCopyNotice({ kind: "failed" });
      return;
    }
    // A category edited meanwhile keeps the user's value; the server never overwrote it either.
    const unsettled = (id: string) => (versions.current[id] ?? 0) !== (settled.current[id] ?? 0);
    const applied = copied.filter((e) => !unsettled(e.categoryId));
    const apply = (h: Hours) =>
      applied.reduce((acc, e) => withValue(acc, e.categoryId, e.hours), h);
    saved.current = apply(saved.current);
    setHours(apply);
    setCopyNotice({ kind: "copied", entries: copied });
  }

  /** Undo a copy: clears each copied entry the user hasn't changed since. */
  function undoCopy(copied: CopiedEntry[]) {
    for (const e of copied) if (hours[e.categoryId] === e.hours) change(e.categoryId, 0);
    setCopyNotice(null);
  }

  function openPicker() {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  const toast = toastId > 0;
  const sheetShown = sheetOpen && selected !== null;
  const navButton =
    "flex h-11 w-11 items-center justify-center rounded-lg text-[24px] disabled:opacity-30";

  return (
    <div className="mx-auto w-full max-w-[1040px] text-navy">
      {/* From 768px this row mirrors the body row's columns so the header centres over the wheel. */}
      <div className="md:flex md:justify-center md:gap-12">
        <div className="flex items-center gap-1 md:w-[min(600px,58vw)] md:min-w-0 md:justify-center">
          <button
            type="button"
            aria-label="Previous day"
            className={navButton}
            onClick={() => goTo(addDays(date, -1))}
          >
            ‹
          </button>
          <span className="relative">
            <button
              type="button"
              className="h-11 px-2 font-display text-[20px]"
              onClick={openPicker}
            >
              {formatDayLabel(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
              value={date}
              max={today ?? undefined}
              onChange={(event) => {
                const day = event.target.value;
                if (isValidDay(day) && day !== date && (today === null || day <= today)) goTo(day);
              }}
            />
          </span>
          <button
            type="button"
            aria-label="Next day"
            className={navButton}
            disabled={!canGoNext}
            onClick={() => goTo(addDays(date, 1))}
          >
            ›
          </button>
          {today !== null && date !== today && (
            <button
              type="button"
              className="ml-auto h-11 px-2 text-teal md:ml-0"
              onClick={() => goTo(today)}
            >
              Today
            </button>
          )}
        </div>
        <div aria-hidden="true" className="hidden md:block md:w-[300px] md:shrink-0" />
      </div>

      <div className="mt-4 md:flex md:items-center md:justify-center md:gap-12">
        <div className="min-w-0 md:w-[min(600px,58vw)]">
          {(offerCopy || copying) && (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                className="h-11 rounded-full border border-teal px-4 text-[14px] text-teal disabled:opacity-60"
                disabled={copying}
                onClick={() => void copyPrevious()}
              >
                {copying ? "Copying…" : copyLabel(date, today, plan.total)}
              </button>
            </div>
          )}
          <Wheel
            ref={wheelRef}
            segments={segments}
            selectedKey={selectedKey}
            total={dayTotal(hours)}
            onSelect={(key) => {
              setSelectedKey(key);
              setActiveRowId(null);
            }}
            onOpen={(key) => {
              setSelectedKey(key);
              setActiveRowId(null);
              setSheetOpen(true);
            }}
          />
        </div>
        <HourSheet
          ref={sheetRef}
          title={selected ? (panel ? selected.mainName : selected.title) : null}
          hours={selected?.editHours ?? 0}
          rows={
            panel ? panel.rows.map((row) => ({ ...row, status: status[row.id] ?? null })) : null
          }
          total={panel?.total ?? 0}
          activeId={activeRowId}
          onActivate={setActiveRowId}
          onRowChange={change}
          open={sheetOpen}
          readOnly={readOnly}
          future={future}
          status={selected ? (status[selected.editId] ?? null) : null}
          onChange={(value) => selected && change(selected.editId, value)}
          onClose={closeSheet}
          overlay={
            toast && sheetShown ? (
              // Inside the sheet so it sits 12px above it on phones; fixed like the other toast from 768px.
              <div
                role="alert"
                className={`absolute bottom-[calc(100%+12px)] md:fixed md:bottom-6 ${TOAST_CLASS}`}
              >
                {SAVE_FAILED_MESSAGE}
              </div>
            ) : null
          }
        />
      </div>

      {copyNotice && !toast && (
        <div
          role={copyNotice.kind === "failed" ? "alert" : "status"}
          className={`fixed bottom-6 flex items-center gap-3 ${
            copyNotice.kind === "failed" ? TOAST_CLASS : `${TOAST_BASE} bg-navy`
          }`}
        >
          {copyNotice.kind === "failed" ? (
            COPY_FAILED_MESSAGE
          ) : (
            <>
              {copiedMessage(copyNotice.entries.length, previousDayName(date, today))}
              {copyNotice.entries.length > 0 && (
                <button
                  type="button"
                  className="-my-2 h-11 font-medium underline"
                  onClick={() => undoCopy(copyNotice.entries)}
                >
                  Undo
                </button>
              )}
            </>
          )}
        </div>
      )}

      {toast && !sheetShown && (
        <div role="alert" className={`fixed bottom-6 ${TOAST_CLASS}`}>
          {SAVE_FAILED_MESSAGE}
        </div>
      )}
    </div>
  );
}
