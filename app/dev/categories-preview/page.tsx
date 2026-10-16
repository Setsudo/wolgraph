import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SUB_FIXTURE_CATEGORIES } from "./fakeCategories";
import { PreviewHarness } from "./PreviewHarness";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const { subs } = await searchParams;
  return subs === "1" ? <PreviewHarness initial={SUB_FIXTURE_CATEGORIES} /> : <PreviewHarness />;
}

// Dev-only preview of the Categories screen with fixture data and fake actions (?subs=1).
export default function CategoriesPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 p-4">
      <Suspense fallback={<p className="text-navy/60">Loading…</p>}>
        <Preview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
