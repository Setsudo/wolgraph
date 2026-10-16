/**
 * Day-wheel view model: joins categories and a day's hours onto the geometry
 * from ./geometry, and keyboard navigation between segments. Pure, no React.
 */
import type { DayCategory, DayEntry } from "@/lib/data/day";
import { formatHours } from "@/lib/hours";
import { layoutWheel, type Segment } from "./geometry";

export const WHEEL_SIZE = 400;

export type WheelSegment = Segment & {
  color: string; // the main's color (subs share it)
  mainName: string;
  subName: string | null; // null for inner segments (including a subless main's full-span one)
  /** Category the sheet edits: the main itself for inner segments, the sub for outer ones. */
  editId: string;
  editHours: number;
  /**
   * Hours driving fill opacity: inner = main own + its active subs + its archived
   * subs (a subless main's full-span segment is its own + archived subs); outer =
   * that sub's own.
   */
  fillHours: number;
  /** "{Main} · general", "{Main} · {Sub}" or "{Main}". */
  title: string;
  /**
   * "{Main}, {Sub or 'general'}, {h} hours"; h is editHours, except on a subless
   * main's full-span segment, where it is fillHours (own + archived subs).
   */
  ariaLabel: string;
};

/** Average glyph width as a fraction of font size, for fitting labels. */
const GLYPH_WIDTH = 0.56;

/**
 * Fits a label into `available` viewBox units: shrinks the font from baseSize
 * down to minSize, then truncates with "…" so that
 * length * GLYPH_WIDTH * fontSize <= available.
 */
export function fitLabel(
  text: string,
  available: number,
  baseSize: number,
  minSize: number = 9,
): { text: string; fontSize: number } {
  const fit = available / (text.length * GLYPH_WIDTH);
  const fontSize = Math.min(baseSize, fit);
  if (fontSize >= minSize) return { text, fontSize };
  const maxLen = Math.max(0, Math.floor(available / (GLYPH_WIDTH * minSize) + 1e-9));
  const cut = maxLen === 0 ? "" : `${text.slice(0, maxLen - 1)}…`;
  return { text: cut, fontSize: minSize };
}

/**
 * Main id of each entry whose category is an archived subcategory, i.e. not among the
 * active `categories` but with a parent. Archived mains are left out.
 */
export function archivedSubParents(
  categories: DayCategory[],
  entries: DayEntry[],
): Record<string, string> {
  const active = new Set(categories.map((c) => c.id));
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (!active.has(e.categoryId) && e.parentId) out[e.categoryId] = e.parentId;
  }
  return out;
}

/**
 * Builds the wheel from active categories (in display order) and hours per category id.
 * `archivedParents` (from archivedSubParents) maps archived subs to their main, whose
 * inner fill then includes their hours; they get no segment of their own.
 */
export function buildWheel(
  categories: DayCategory[],
  hours: Record<string, number>,
  archivedParents: Record<string, string> = {},
  size: number = WHEEL_SIZE,
): WheelSegment[] {
  const mains = categories.filter((c) => c.parentId === null);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const subsOf = new Map<string, DayCategory[]>(mains.map((m) => [m.id, []]));
  for (const c of categories) {
    if (c.parentId !== null) subsOf.get(c.parentId)?.push(c);
  }
  const h = (id: string) => hours[id] ?? 0;
  const archivedHours = new Map<string, number>();
  for (const [id, mainId] of Object.entries(archivedParents)) {
    archivedHours.set(mainId, (archivedHours.get(mainId) ?? 0) + h(id));
  }

  const segments = layoutWheel(
    mains.map((m) => ({ id: m.id, subIds: (subsOf.get(m.id) ?? []).map((s) => s.id) })),
    { size },
  );

  return segments.map((seg) => {
    const main = byId.get(seg.mainId)!;
    const subs = subsOf.get(main.id) ?? [];
    // Outer segments are always subs; a subless main is one inner segment.
    const sub = seg.ring === "outer" ? byId.get(seg.categoryId)! : null;
    const editId = sub ? sub.id : main.id;
    const editHours = h(editId);
    const fillHours =
      seg.ring === "inner"
        ? subs.reduce((sum, s) => sum + h(s.id), h(main.id) + (archivedHours.get(main.id) ?? 0))
        : editHours;
    // A subless main's segment stands for the whole main, so it reads out what it shows.
    const labelHours = seg.ring === "inner" && subs.length === 0 ? fillHours : editHours;
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
      ariaLabel: `${main.name}, ${sub ? sub.name : "general"}, ${formatHours(labelHours)} hours`,
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
 * ring (wrapping), Down goes inner -> first outer segment of the same main
 * (staying put on a subless main, which has none), Up goes outer -> its main's
 * inner segment. With nothing selected, the first inner segment.
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
