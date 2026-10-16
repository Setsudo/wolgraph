"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <button type="button" className={className} onClick={signOut}>
      Sign out
    </button>
  );
}
