import { Suspense } from "react";
import { CanonicalizeTrendsUrl } from "@/components/trends/CanonicalizeTrendsUrl";
import { TrendsView } from "@/components/trends/TrendsView";
import { periodFor } from "@/lib/data/period";
import { getTrendData } from "@/lib/data/trends";
import { parseAnchor, parseKind, parseTrendsParams } from "@/lib/trends/format";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Trends({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = parseTrendsParams(raw);
  if (!params) {
    return (
      <CanonicalizeTrendsUrl basePath="/trends" kind={parseKind(raw)} anchor={parseAnchor(raw)} />
    );
  }
  const aggregate = await getTrendData(periodFor(params.kind, params.anchor));
  return <TrendsView aggregate={aggregate} anchor={params.anchor} basePath="/trends" />;
}

export default function TrendsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-navy/70">Loading…</p>}>
      <Trends searchParams={searchParams} />
    </Suspense>
  );
}
