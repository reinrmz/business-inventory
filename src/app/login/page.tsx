import Link from "next/link";
import { loginAsDemo } from "../(auth)/actions";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Welcome back</p>
        <h1 className="font-display text-2xl font-bold">Log in</h1>
      </div>

      <LoginForm />

      <div className="text-center text-sm text-ink-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </div>

      <div className="label-card label-card--gold space-y-2 p-5 text-center">
        <p className="text-sm font-medium">Just want to look around?</p>
        <form action={loginAsDemo}>
          <button className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90">
            Try the demo
          </button>
        </form>
        <p className="text-xs text-ink-muted">
          or sign in manually with <span className="tnum">demo@vessel.app</span> /{" "}
          <span className="tnum">demodemo</span>
        </p>
      </div>
    </div>
  );
}
