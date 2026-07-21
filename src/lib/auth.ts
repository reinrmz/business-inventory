import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_COOKIE = "session";
const BUSINESS_COOKIE = "activeBusinessId";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Creates a Session row and sets the httpOnly cookie. The raw token only
// ever exists in the cookie + this return value - the DB stores a hash of
// it, so a DB leak alone can't be used to forge a valid session.
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(BUSINESS_COOKIE);
}

export type CurrentUserResult =
  | { user: null; reason: "unauthenticated" }
  | { user: null; reason: "pending" | "rejected" }
  | { user: NonNullable<Awaited<ReturnType<typeof loadUserFromToken>>>; reason: null };

async function loadUserFromToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

// The single choke point every page/action calls to find out who's logged
// in AND whether they're allowed to actually use the app yet (approval
// gating - see CLAUDE.md section 9). Login can succeed for a pending/
// rejected user (their credentials are valid), but this helper is what
// blocks usage past that point.
export async function getCurrentUser(): Promise<CurrentUserResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { user: null, reason: "unauthenticated" };

  const user = await loadUserFromToken(token);
  if (!user) return { user: null, reason: "unauthenticated" };

  if (user.status === "PENDING") return { user: null, reason: "pending" };
  if (user.status === "REJECTED") return { user: null, reason: "rejected" };

  return { user, reason: null };
}

export type CurrentBusinessResult =
  | { businessId: null; reason: "no-active-business" | "not-a-member" | "business-pending" }
  | { businessId: number; reason: null };

// Reads the activeBusinessId cookie and re-validates it against Membership
// on every call - a cookie value alone is never trusted (a user could edit
// it to point at a business they don't belong to).
export async function getCurrentBusinessId(userId: number): Promise<CurrentBusinessResult> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(BUSINESS_COOKIE)?.value;
  const businessId = raw ? Number(raw) : NaN;
  if (!businessId || Number.isNaN(businessId)) {
    return { businessId: null, reason: "no-active-business" };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
    include: { business: true },
  });
  if (!membership) return { businessId: null, reason: "not-a-member" };
  if (membership.business.status !== "APPROVED") {
    return { businessId: null, reason: "business-pending" };
  }

  return { businessId, reason: null };
}

// Convenience wrapper for pages/actions that just need "give me the active
// businessId, or send the user wherever they need to go instead." Every
// page in products/, inventory/, sales/, and the dashboard calls this once
// at the top instead of repeating the getCurrentUser + getCurrentBusinessId
// + redirect boilerplate (CLAUDE.md section 9).
export async function requireBusinessContext() {
  const { user, reason } = await getCurrentUser();
  if (!user) {
    redirect(reason === "unauthenticated" ? "/login" : `/pending-approval?reason=${reason}`);
  }

  const { businessId, reason: businessReason } = await getCurrentBusinessId(user.id);
  if (!businessId) {
    if (businessReason === "business-pending") {
      redirect("/pending-approval?reason=pending");
    }
    redirect("/businesses/new");
  }

  return { user, businessId };
}

export async function setActiveBusiness(businessId: number) {
  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_COOKIE, String(businessId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
