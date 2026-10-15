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
