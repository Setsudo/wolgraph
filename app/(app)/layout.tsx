import type { ReactNode } from "react";
import Link from "next/link";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Main" className="flex gap-4 p-4">
        <Link href="/">Day</Link>
        <Link href="/trends">Trends</Link>
        <Link href="/categories">Categories</Link>
      </nav>
      <main className="flex-1 p-4">{children}</main>
    </>
  );
}
