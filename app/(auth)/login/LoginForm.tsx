"use client";

import { useState, type FormEvent } from "react";
import { sanitizeNext } from "@/lib/auth/routing";
import { SUPABASE_NOT_CONFIGURED, getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent";

const FALLBACK_ERROR = "Something went wrong. Try again.";
const NOT_CONFIGURED_ERROR = `${SUPABASE_NOT_CONFIGURED}.`;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(getSupabaseEnv() ? null : NOT_CONFIGURED_ERROR);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!getSupabaseEnv()) {
      setError(NOT_CONFIGURED_ERROR);
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const next = sanitizeNext(new URLSearchParams(window.location.search).get("next"));
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);
      const { error: otpError } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callback.toString() },
      });
      if (otpError) {
        setError(otpError.message || FALLBACK_ERROR);
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError(FALLBACK_ERROR);
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-8 text-center text-navy">
        <h2 className="font-display text-[20px]">Check your email</h2>
        <p className="mt-2">We sent a sign-in link to {email}.</p>
        <button
          type="button"
          className="mt-4 text-teal underline underline-offset-2"
          onClick={() => setStatus("idle")}
        >
          Use a different email
        </button>
      </div>
    );
  }

  const sending = status === "sending";
  return (
    <form className="mt-8" onSubmit={handleSubmit}>
      <label htmlFor="email" className="block text-navy">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "email-error" : undefined}
        className="mt-1 h-11 w-full rounded-lg border border-navy/30 bg-white px-3 text-navy focus:ring-2 focus:ring-teal focus:outline-none"
      />
      {error && (
        <p id="email-error" role="alert" className="mt-2 text-amber">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="mt-4 h-11 w-full rounded-lg bg-teal text-cream disabled:opacity-70"
      >
        {sending ? "Sending…" : "Send link"}
      </button>
    </form>
  );
}
