import type { DayCategory, DayEntry } from "@/lib/data/day";

/** The eight seeded mains (SPEC §7) with two subs each on Health and Career. Dev preview only. */
export const PREVIEW_CATEGORIES: DayCategory[] = [
  { id: "health", parentId: null, name: "Health", color: "#2F8C8C" },
  { id: "personal-growth", parentId: null, name: "Personal Growth", color: "#5B6CC0" },
  { id: "finance", parentId: null, name: "Finance", color: "#3E8E4F" },
  { id: "family", parentId: null, name: "Family", color: "#C9831F" },
  { id: "career", parentId: null, name: "Career", color: "#C8553D" },
  { id: "relaxation", parentId: null, name: "Relaxation", color: "#7A5BA8" },
  { id: "relationships", parentId: null, name: "Relationships", color: "#C2557F" },
  { id: "spirituality", parentId: null, name: "Spirituality", color: "#4F7C9E" },
  { id: "sleep", parentId: "health", name: "Sleep", color: "#2F8C8C" },
  { id: "exercise", parentId: "health", name: "Exercise", color: "#2F8C8C" },
  { id: "deep-work", parentId: "career", name: "Deep work", color: "#C8553D" },
  { id: "meetings", parentId: "career", name: "Meetings", color: "#C8553D" },
];

export const PREVIEW_ENTRIES: DayEntry[] = [
  { categoryId: "sleep", hours: 7.5 },
  { categoryId: "exercise", hours: 1 },
  { categoryId: "deep-work", hours: 4 },
  { categoryId: "meetings", hours: 2 },
  { categoryId: "family", hours: 2 },
  { categoryId: "relaxation", hours: 1 },
];

const CAREER_SUBS = [
  "Deep work",
  "Meetings",
  "Email",
  "Planning",
  "Hiring",
  "Mentoring",
  "Writing",
  "Reviews",
  "Admin",
  "Learning",
];

/**
 * `?subs=1`: the eight mains with Health split into 3 subs and Career into 10
 * (the charter maximum). Career's archived "Side project" is not listed (archived
 * categories leave the wheel) but has hours in SUB_PREVIEW_ENTRIES.
 */
export const SUB_PREVIEW_CATEGORIES: DayCategory[] = [
  ...PREVIEW_CATEGORIES.filter((c) => c.parentId === null),
  ...["Sleep", "Exercise", "Meditation"].map((name) => ({
    id: `health-${name.toLowerCase()}`,
    parentId: "health",
    name,
    color: "#2F8C8C",
  })),
  ...CAREER_SUBS.map((name) => ({
    id: `career-${name.toLowerCase().replace(/\s+/g, "-")}`,
    parentId: "career",
    name,
    color: "#C8553D",
  })),
];

export const SUB_PREVIEW_ENTRIES: DayEntry[] = [
  { categoryId: "health-sleep", hours: 7.5 },
  { categoryId: "health-exercise", hours: 1 },
  { categoryId: "health-meditation", hours: 0.5 },
  { categoryId: "career", hours: 0.5 },
  { categoryId: "career-deep-work", hours: 3 },
  { categoryId: "career-meetings", hours: 1.5 },
  { categoryId: "career-email", hours: 0.75 },
  { categoryId: "career-reviews", hours: 1 },
  { categoryId: "career-side-project", hours: 1.5 }, // archived sub: counts in the total only
  { categoryId: "family", hours: 2 },
  { categoryId: "relaxation", hours: 1 },
];
