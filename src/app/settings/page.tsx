import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";
import { AttributesSection } from "./attributes-section";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { businessId } = await requireBusinessContext();
  const [settings, attributes] = await Promise.all([
    getSettings(businessId),
    prisma.attribute.findMany({
      where: { businessId },
      include: { values: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Configure</p>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Currency, reinvestment goal, and the thresholds that drive low-stock and
          expiring-soon alerts.
        </p>
      </div>

      <section className="label-card p-6">
        <SettingsForm initial={settings} />
      </section>

      <section className="label-card p-6">
        <AttributesSection attributes={attributes} />
      </section>

      <section className="label-card p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
