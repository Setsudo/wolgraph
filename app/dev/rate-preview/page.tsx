import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RatePreview } from "./RatePreview";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const { unavailable } = await searchParams;
  return <RatePreview unavailable={unavailable === "1"} />;
}

/** Dev-only: the rate screen with fixtures and a fake save (?unavailable=1, ?fail=1). */
export default function RatePreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 p-4">
      <Suspense fallback={<p className="text-navy/60">Loading…</p>}>
        <Preview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
