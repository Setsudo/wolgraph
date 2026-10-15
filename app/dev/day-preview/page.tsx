import { notFound } from "next/navigation";
import { DayPreview } from "./DayPreview";

/** Development-only preview of the daily entry screen with fixture data and a fake save. */
export default function DayPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 p-4">
      <DayPreview />
    </main>
  );
}
