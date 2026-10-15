"use client";

import { useMemo, useRef, useState } from "react";
import { CategoriesScreen } from "@/app/(app)/categories/CategoriesScreen";
import type { ArchiveResult, Category, CategoryActions } from "@/lib/data/categoryRules";
import { applyFakeOp, FIXTURE_CATEGORIES, type FakeOp, type FakeResult } from "./fakeCategories";

/** The real Categories screen backed by local state and fake actions that settle after `delayMs`. */
export function PreviewHarness({
  initial = FIXTURE_CATEGORIES,
  delayMs = 200,
}: {
  initial?: Category[];
  delayMs?: number;
}) {
  const [categories, setCategories] = useState(initial);
  const latest = useRef(initial);

  const actions = useMemo<CategoryActions>(() => {
    const perform = (op: FakeOp) =>
      new Promise<FakeResult["result"]>((resolve) => {
        setTimeout(() => {
          const { result, categories: next } = applyFakeOp(
            latest.current,
            op,
            new Date().toISOString(),
          );
          latest.current = next;
          setCategories(next);
          resolve(result);
        }, delayMs);
      });
    return {
      addMain: (name, color) => perform({ type: "addMain", name, color }),
      addSub: (parentId, name) => perform({ type: "addSub", parentId, name }),
      rename: (id, name) => perform({ type: "rename", id, name }),
      // applyFakeOp's archive success always carries archivedIds.
      archive: (id) => perform({ type: "archive", id }) as Promise<ArchiveResult>,
      restore: (id) => perform({ type: "restore", id }),
    };
  }, [delayMs]);

  return <CategoriesScreen categories={categories} actions={actions} />;
}
