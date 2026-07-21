import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { approveUser, rejectUser, approveBusiness, rejectBusiness } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await getCurrentUser();
  if (!user?.isAdmin) {
    redirect("/");
  }

  const [pendingUsers, pendingBusinesses] = await Promise.all([
    prisma.user.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.business.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { memberships: { include: { user: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Admin</p>
        <h1 className="font-display text-2xl font-bold">Pending approvals</h1>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 font-display text-lg font-bold">
          Users ({pendingUsers.length})
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {pendingUsers.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{u.email}</td>
                <td className="px-5 py-3 text-ink-muted">{u.name ?? "—"}</td>
                <td className="px-5 py-3 text-ink-muted">
                  {u.createdAt.toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <form action={approveUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-standard hover:opacity-90">
                        Approve
                      </button>
                    </form>
                    <form action={rejectUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-standard hover:border-danger hover:text-danger">
                        Reject
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {pendingUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-ink-muted">
                  No pending users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-4 font-display text-lg font-bold">
          Businesses ({pendingBusinesses.length})
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {pendingBusinesses.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{b.name}</td>
                <td className="px-5 py-3 text-ink-muted">
                  {b.memberships.map((m) => m.user.email).join(", ") || "—"}
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {b.createdAt.toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <form action={approveBusiness}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-standard hover:opacity-90">
                        Approve
                      </button>
                    </form>
                    <form action={rejectBusiness}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-standard hover:border-danger hover:text-danger">
                        Reject
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {pendingBusinesses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-ink-muted">
                  No pending businesses.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
