import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getCurrentBusinessId } from "@/lib/auth";
import { logout } from "./(auth)/actions";
import { ThemeToggle } from "./theme-toggle";
import { BusinessSwitcherSelect } from "./business-switcher-select";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sales", label: "Sales" },
];

export async function Header() {
  const { user } = await getCurrentUser();

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center gap-8 px-6 py-4">
        <BrandLink userId={user?.id ?? null} />
        {user && (
          <div className="flex flex-1 gap-6 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-ink-muted transition-standard hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            {user.isAdmin && (
              <Link
                href="/admin"
                className="text-ink-muted transition-standard hover:text-ink"
              >
                Admin
              </Link>
            )}
          </div>
        )}
        {!user && <div className="flex-1" />}
        {user && <BusinessSwitcher userId={user.id} />}
        <ThemeToggle />
        {user && (
          <form action={logout}>
            <button className="text-xs font-medium text-ink-muted underline decoration-border underline-offset-2 transition-standard hover:text-accent">
              Log out
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}

async function BrandLink({ userId }: { userId: number | null }) {
  let businessName: string | null = null;

  if (userId !== null) {
    const current = await getCurrentBusinessId(userId);
    if (current.businessId) {
      const business = await prisma.business.findUnique({ where: { id: current.businessId } });
      businessName = business?.name ?? null;
    }
  }

  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
      <span className="font-display text-lg font-bold tracking-tight">
        {businessName ?? "Vessel"}
      </span>
    </Link>
  );
}

async function BusinessSwitcher({ userId }: { userId: number }) {
  const [memberships, current] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      include: { business: true },
      orderBy: { createdAt: "asc" },
    }),
    getCurrentBusinessId(userId),
  ]);

  const approvedMemberships = memberships.filter((m) => m.business.status === "APPROVED");
  if (approvedMemberships.length === 0) return null;

  return (
    <BusinessSwitcherSelect
      businesses={approvedMemberships.map((m) => ({ id: m.businessId, name: m.business.name }))}
      currentBusinessId={current.businessId}
    />
  );
}
