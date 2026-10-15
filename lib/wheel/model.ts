/**
 * Day-wheel view model: joins categories and a day's hours onto the geometry
 * from ./geometry, and keyboard navigation between segments. Pure, no React.
 */
import type { DayCategory } from "@/lib/data/day";
import { formatHours } from "@/lib/hours";
import { layoutWheel, type Segment } from "./geometry";

export const WHEEL_SIZE = 400;

export type WheelSegment = Segment & {
  color: string; // the main's color (subs share it)
  mainName: string;
  subName: string | null; // null for inner segments and for a main with no subs
  /** Category the sheet edits: the main itself for inner segments and subless mains. */
  editId: string;
  editHours: number;
  /** Hours driving fill opacity: inner = main own + its subs; outer = that segment's own. */
  fillHours: number;
  /** "{Main} · general", "{Main} · {Sub}" or "{Main}". */
  title: string;
  /** "{Main}, {Sub or 'general'}, {h} hours". */
  ariaLabel: string;
};

/** Truncates to at most `max` characters, ending with "…" when shortened. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Builds the wheel from active categories (in display order) and hours per category id. */
export function buildWheel(
  categories: DayCategory[],
  hours: Record<string, number>,
  size: number = WHEEL_SIZE,
): WheelSegment[] {
  const mains = categories.filter((c) => c.parentId === null);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const subsOf = new Map<string, DayCategory[]>(mains.map((m) => [m.id, []]));
  for (const c of categories) {
    if (c.parentId !== null) subsOf.get(c.parentId)?.push(c);
  }
  const h = (id: string) => hours[id] ?? 0;

  const segments = layoutWheel(
    mains.map((m) => ({ id: m.id, subIds: (subsOf.get(m.id) ?? []).map((s) => s.id) })),
    { size },
  );

  return segments.map((seg) => {
    const main = byId.get(seg.mainId)!;
    const subs = subsOf.get(main.id) ?? [];
    const sub =
      seg.ring === "outer" && seg.categoryId !== main.id ? byId.get(seg.categoryId)! : null;
    const editId = sub ? sub.id : main.id;
    const editHours = h(editId);
    const fillHours =
      seg.ring === "inner" ? subs.reduce((sum, s) => sum + h(s.id), h(main.id)) : editHours;
    const title = sub
      ? `${main.name} · ${sub.name}`
      : subs.length > 0
        ? `${main.name} · general`
        : main.name;
    return {
      ...seg,
      color: main.color,
      mainName: main.name,
      subName: sub ? sub.name : null,
      editId,
      editHours,
      fillHours,
      title,
      ariaLabel: `${main.name}, ${sub ? sub.name : "general"}, ${formatHours(editHours)} hours`,
    };
  });
}

/** Sum of every entry of the day, including archived categories. */
export function dayTotal(hours: Record<string, number>): number {
  return Object.values(hours).reduce((sum, v) => sum + v, 0);
}

export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * Segment key after pressing an arrow on `current`. Left/Right move within the
 * ring (wrapping), Down goes inner -> first outer segment of the same main, Up
 * goes outer -> its main's inner segment. With nothing selected, the first
 * inner segment.
 */
export function navigate(segments: Segment[], current: string | null, key: NavKey): string | null {
  if (segments.length === 0) return null;
  const cur = segments.find((s) => s.key === current);
  if (!cur) return segments[0].key;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const ring = segments.filter((s) => s.ring === cur.ring);
    const i = ring.indexOf(cur);
    const step = key === "ArrowRight" ? 1 : -1;
    return ring[(i + step + ring.length) % ring.length].key;
  }
  if (key === "ArrowDown" && cur.ring === "inner") {
    return segments.find((s) => s.ring === "outer" && s.mainId === cur.mainId)?.key ?? cur.key;
  }
  if (key === "ArrowUp" && cur.ring === "outer") {
    return segments.find((s) => s.ring === "inner" && s.mainId === cur.mainId)?.key ?? cur.key;
  }
  return cur.key;
}
