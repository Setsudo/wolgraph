import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wheel of Life",
  description: "Log how you spend your hours across the areas of your life.",
};

/**
 * Runs before first paint: flags <html> when motion is allowed, so CSS can
 * hide the life wheel's value shape until its pop-in starts (no flash of the
 * finished wheel). Without JS or with reduced motion the flag is never set and
 * the server-rendered final state shows.
 */
const MOTION_FLAG = `try{if(matchMedia("(prefers-reduced-motion: no-preference)").matches)document.documentElement.dataset.motion="ok"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
