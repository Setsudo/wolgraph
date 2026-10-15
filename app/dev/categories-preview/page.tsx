import { notFound } from "next/navigation";
import { PreviewHarness } from "./PreviewHarness";

// Dev-only preview of the Categories screen with fixture data and fake actions.
export default function CategoriesPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 p-4">
      <PreviewHarness />
    </main>
  );
}
