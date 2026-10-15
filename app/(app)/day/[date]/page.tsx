import { Suspense } from "react";

async function DayHeading({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <h1 className="font-display text-2xl">Day {date}</h1>;
}

export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  return (
    <>
      <Suspense>
        <DayHeading params={params} />
      </Suspense>
      <p>Placeholder: daily entry wheel.</p>
    </>
  );
}
