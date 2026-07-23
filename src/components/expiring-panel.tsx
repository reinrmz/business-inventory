import Link from "next/link";

type ExpiringVariant = {
  id: number;
  productName: string;
  attributeLabel: string;
  stockQty: number;
  expiresAt: Date;
  daysUntil: number;
};

const TIER_LIMIT = 4;

function dateLabel(d: Date) {
  return d.toISOString().slice(0, 10);
}

function expiredStatus(daysUntil: number) {
  return `EXPIRED ${-daysUntil}d ago`;
}

function soonStatus(daysUntil: number) {
  if (daysUntil === 0) return "EXPIRES TODAY";
  if (daysUntil === 1) return "1 day left";
  return `${daysUntil} days left`;
}

export function ExpiringPanel({ variants }: { variants: ExpiringVariant[] }) {
  // Split by severity: already expired (pull from shelf) vs expiring soon
  // (discount / move it). daysUntil === 0 counts as expiring soon, not expired.
  const expired = variants.filter((v) => v.daysUntil < 0);
  const soon = variants.filter((v) => v.daysUntil >= 0);

  return (
    <section className="label-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Expiry</h2>
        {variants.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              expired.length > 0 ? "bg-danger-soft text-danger" : "bg-gold-soft text-gold"
            }`}
          >
            {variants.length}
          </span>
        )}
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing expired or expiring within a week. Nice.</p>
      ) : (
        <div className="space-y-4">
          <Tier
            label="Expired"
            tone="danger"
            items={expired}
            href="/inventory?expiry=expired"
            renderStatus={(v) => expiredStatus(v.daysUntil)}
          />
          <Tier
            label="Expiring soon"
            tone="warning"
            items={soon}
            href="/inventory?expiry=soon"
            renderStatus={(v) => soonStatus(v.daysUntil)}
          />
        </div>
      )}
    </section>
  );
}

function Tier({
  label,
  tone,
  items,
  href,
  renderStatus,
}: {
  label: string;
  tone: "danger" | "warning";
  items: ExpiringVariant[];
  href: string;
  renderStatus: (v: ExpiringVariant) => string;
}) {
  if (items.length === 0) return null;

  const dot = tone === "danger" ? "bg-danger" : "bg-gold";
  const statusColor = tone === "danger" ? "text-danger" : "text-gold";
  const countBg =
    tone === "danger" ? "bg-danger-soft text-danger" : "bg-gold-soft text-gold";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${countBg}`}>
          {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.slice(0, TIER_LIMIT).map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{v.productName}</p>
              <p className="truncate text-xs text-ink-muted">
                {v.attributeLabel ? `${v.attributeLabel} · ` : ""}
                {dateLabel(v.expiresAt)} · {v.stockQty} in stock
              </p>
            </div>
            <span className={`tnum shrink-0 text-xs font-semibold ${statusColor}`}>
              {renderStatus(v)}
            </span>
          </li>
        ))}
      </ul>
      {items.length > TIER_LIMIT && (
        <Link
          href={href}
          className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
        >
          + {items.length - TIER_LIMIT} more
        </Link>
      )}
    </div>
  );
}
