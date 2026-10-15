import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DayView } from "@/components/DayView";
import { getDay } from "@/lib/data/day";
import { isValidDay } from "@/lib/date";
import { saveEntry } from "./actions";

async function DayContent({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDay(date)) notFound();
  const { categories, entries } = await getDay(date);
  return (
    <DayView key={date} date={date} categories={categories} entries={entries} save={saveEntry} />
  );
}

export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  return (
    <Suspense fallback={<p className="text-navy/60">Loading…</p>}>
      <DayContent params={params} />
    </Suspense>
  );
}
