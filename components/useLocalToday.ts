"use client";

import { useSyncExternalStore } from "react";
import { todayLocal } from "@/lib/date";

const noopSubscribe = () => () => {};

/** The browser's local date (YYYY-MM-DD), or null during server rendering and hydration. */
export function useLocalToday(): string | null {
  return useSyncExternalStore(noopSubscribe, todayLocal, () => null);
}
