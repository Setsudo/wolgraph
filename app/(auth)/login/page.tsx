import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-4 py-8">
      <div className="w-full max-w-[360px]">
        <h1 className="text-center font-display text-[32px] text-navy">Wheel of Life</h1>
        <p className="mt-2 text-center text-navy/70">Sign in with a link sent to your email.</p>
        <LoginForm />
      </div>
    </main>
  );
}
