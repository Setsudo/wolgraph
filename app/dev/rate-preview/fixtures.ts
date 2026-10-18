import type { RateMain } from "@/lib/data/ratings";

/** The eight seeded mains (SPEC §7). Dev preview only. */
export const PREVIEW_MAINS: RateMain[] = [
  { id: "health", name: "Health", color: "#2F8C8C" },
  { id: "personal-growth", name: "Personal Growth", color: "#5B6CC0" },
  { id: "finance", name: "Finance", color: "#3E8E4F" },
  { id: "family", name: "Family", color: "#C9831F" },
  { id: "career", name: "Career", color: "#C8553D" },
  { id: "relaxation", name: "Relaxation", color: "#7A5BA8" },
  { id: "relationships", name: "Relationships", color: "#C2557F" },
  { id: "spirituality", name: "Spirituality", color: "#4F7C9E" },
];

/** Today's scores: three categories already rated today; the rest show 0. */
export const PREVIEW_SCORES: Record<string, number> = { health: 8, finance: 9, family: 7 };

