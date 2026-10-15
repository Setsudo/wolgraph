import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { todayLocal } from "@/lib/date";

async function RedirectToToday(): Promise<never> {
  await connection();
  redirect(`/day/${todayLocal()}`);
}

export default function Home() {
  return (
    <Suspense>
      <RedirectToToday />
    </Suspense>
  );
}
