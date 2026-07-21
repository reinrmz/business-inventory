import { logout } from "../(auth)/actions";

const MESSAGES: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Awaiting approval",
    body: "Your account (or business) is waiting on admin approval. You'll be able to log in as soon as that's done.",
  },
  rejected: {
    title: "Access not granted",
    body: "This account wasn't approved. If you think that's a mistake, reach out directly.",
  },
};

export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = MESSAGES[reason ?? "pending"] ?? MESSAGES.pending;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16 text-center">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Account status</p>
        <h1 className="font-display text-2xl font-bold">{message.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{message.body}</p>
      </div>
      <form action={logout}>
        <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-standard hover:border-accent hover:text-accent">
          Log out
        </button>
      </form>
    </div>
  );
}
