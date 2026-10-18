import { Suspense } from "react";
import { connection } from "next/server";
import { RateTodayGate } from "@/components/RateTodayGate";
import { RateView } from "@/components/RateView";
import { getRatings } from "@/lib/data/ratings";
import { isValidDay, latestDayAnywhere } from "@/lib/date";
import { saveRating } from "./actions";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function RateContent({ searchParams }: { searchParams: SearchParams }) {
  // Per-user data: never prerender.
  await connection();
  const { day } = await searchParams;
  // ?day is the day to rate; RateTodayGate fills in the local today and turns away later days.
  if (!isValidDay(day) || day > latestDayAnywhere(new Date())) return <RateTodayGate day={null} />;
  const { mains, scores, available } = await getRatings(day);
  return (
    <RateTodayGate day={day}>
      <RateView
        key={day}
        day={day}
        mains={mains}
        scores={scores}
        available={available}
        save={saveRating}
      />
    </RateTodayGate>
  );
}

export default function RatePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-navy/60">Loading…</p>}>
      <RateContent searchParams={searchParams} />
    </Suspense>
  );
}
