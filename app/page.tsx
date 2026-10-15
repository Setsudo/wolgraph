import { redirect } from "next/navigation";

/** Home is the "Rate your life" screen. */
export default function Home() {
  redirect("/rate");
}
