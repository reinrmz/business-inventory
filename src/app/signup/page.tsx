import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Get started</p>
        <h1 className="font-display text-2xl font-bold">Sign up</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your account and business need a quick approval before you can log in.
        </p>
      </div>

      <SignupForm />

      <div className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </div>
    </div>
  );
}
