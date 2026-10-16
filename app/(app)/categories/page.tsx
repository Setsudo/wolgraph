import { Suspense } from "react";
import { listCategories } from "@/lib/data/categories";
import { CategoriesHeading, CategoriesScreen } from "./CategoriesScreen";
import { addMain, addSub, archive, rename, restore } from "./actions";

async function CategoriesContent() {
  const categories = await listCategories();
  return (
    <CategoriesScreen
      categories={categories}
      actions={{ addMain, addSub, rename, archive, restore }}
    />
  );
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[640px]">
          <CategoriesHeading />
        </div>
      }
    >
      <CategoriesContent />
    </Suspense>
  );
}
