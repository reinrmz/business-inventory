import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createBusiness } from "../../(auth)/actions";

export default async function NewBusinessPage() {
  const { user, reason } = await getCurrentUser();
  if (!user) {
    redirect(reason === "unauthenticated" ? "/login" : "/pending-approval?reason=" + reason);
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">New business</p>
        <h1 className="font-display text-2xl font-bold">Create a business</h1>
        <p className="mt-1 text-sm text-ink-muted">
          New businesses need admin approval before they're usable.
        </p>
      </div>

      <form action={createBusiness} className="label-card space-y-3 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Business name</label>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Currency</label>
          <select
            name="currency"
            defaultValue="PHP"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="PHP">₱ PHP — Philippine Peso</option>
            <option value="USD">$ USD — US Dollar</option>
            <option value="EUR">€ EUR — Euro</option>
            <option value="GBP">£ GBP — British Pound</option>
          </select>
        </div>
        <button className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-standard hover:opacity-90">
          Create business
        </button>
      </form>
    </div>
  );
}
