"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PeriodKind } from "@/lib/data/period";
import { todayLocal } from "@/lib/date";
import { trendsHref } from "@/lib/trends/format";

/**
 * Replaces a trends URL missing a valid kind or anchor with the canonical one:
 * kind defaults to week, anchor to the browser's local today.
 */
export function CanonicalizeTrendsUrl({
  basePath,
  kind,
  anchor,
}: {
  basePath: string;
  kind: PeriodKind | null;
  anchor: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(
      trendsHref(basePath, window.location.search, kind ?? "week", anchor ?? todayLocal()),
    );
  }, [router, basePath, kind, anchor]);

  return <p className="text-navy/70">Loading…</p>;
}
