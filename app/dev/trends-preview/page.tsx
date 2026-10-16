import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CanonicalizeTrendsUrl } from "@/components/trends/CanonicalizeTrendsUrl";
import { TrendsView } from "@/components/trends/TrendsView";
import { aggregatePeriod } from "@/lib/data/aggregates";
import { periodFor } from "@/lib/data/period";
import { withRatings } from "@/lib/data/ratingAggregates";
import { parseAnchor, parseKind, parseTrendsParams } from "@/lib/trends/format";
import { previewCategories, previewEntries, previewRatings, type PreviewVariant } from "./fixtures";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
const BASE = "/dev/trends-preview";

async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = parseTrendsParams(raw);
  if (!params) {
    return (
      <CanonicalizeTrendsUrl basePath={BASE} kind={parseKind(raw)} anchor={parseAnchor(raw)} />
    );
  }
  const variant: PreviewVariant =
    raw.empty === "1" ? "empty" : raw.few === "1" ? "few" : raw.subs === "1" ? "subs" : "full";
  const period = periodFor(params.kind, params.anchor);
  const aggregate = withRatings(
    aggregatePeriod(previewCategories(variant), previewEntries(variant, params.anchor), period),
    previewRatings(variant, params.anchor),
  );
  return <TrendsView aggregate={aggregate} anchor={params.anchor} basePath={BASE} />;
}

/** Dev-only: the trends screen with fixture data (?kind, ?anchor, ?empty=1, ?few=1, ?subs=1). */
export default function TrendsPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 p-4">
      <Suspense fallback={<p className="text-navy/70">Loading…</p>}>
        <Preview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
