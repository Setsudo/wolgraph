import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DayPreview } from "./DayPreview";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const { subs, copy } = await searchParams;
  return <DayPreview subs={subs === "1"} copy={copy === "1"} />;
}

/** Development-only preview of the daily entry screen with fixture data and a fake save (?fail=1, ?subs=1, ?copy=1). */
export default function DayPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 p-4">
      <Suspense fallback={<p className="text-navy/60">Loading…</p>}>
        <Preview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
