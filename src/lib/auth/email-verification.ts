import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { sendSmtpEmail } from "@/lib/email/smtp";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export type EmailVerificationStatus =
  | "VERIFIED"
  | "INVALID"
  | "EXPIRED"
  | "ALREADY_VERIFIED";

export interface EmailVerificationResult {
  status: EmailVerificationStatus;
  userId: string | null;
  email: string | null;
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function parseBoolean(value: string | undefined): boolean {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

export function isEmailAutoVerificationEnabled(): boolean {
  return parseBoolean(process.env.AUTH_AUTO_VERIFY_EMAIL);
}

export async function autoVerifyEmailIfEnabled(opts: {
  userId: string;
  emailVerifiedAt: Date | null;
}): Promise<Date | null> {
  if (opts.emailVerifiedAt || !isEmailAutoVerificationEnabled()) {
    return opts.emailVerifiedAt;
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: opts.userId },
    data: { emailVerifiedAt: now },
  });

  return now;
}

function hashVerificationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateRawVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getAppUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  throw new Error("APP_URL is required in production for email verification links");
}

export function buildEmailVerificationUrl(rawToken: string): string {
  return `${getAppUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export async function rotateEmailVerificationToken(userId: string): Promise<string> {
  const now = new Date();
  const rawToken = generateRawVerificationToken();
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  });

  return rawToken;
}

export async function sendEmailVerificationMessage(opts: {
  email: string;
  rawToken: string;
}): Promise<void> {
  const verificationUrl = buildEmailVerificationUrl(opts.rawToken);
  await sendSmtpEmail({
    to: opts.email,
    subject: "Confirm your EXPP email",
    text: [
      "Welcome to EXPP.",
      "",
      "Please confirm your email address to activate your account:",
      verificationUrl,
      "",
      "If you didn't create this account, you can ignore this message.",
    ].join("\n"),
    html: [
      "<p>Welcome to EXPP.</p>",
      "<p>Please confirm your email address to activate your account:</p>",
      `<p><a href="${verificationUrl}">Confirm email address</a></p>`,
      "<p>If you didn't create this account, you can ignore this message.</p>",
    ].join(""),
  });
}

export async function verifyEmailByToken(rawToken: string): Promise<EmailVerificationResult> {
  const normalizedToken = rawToken.trim();
  if (!normalizedToken) {
    return { status: "INVALID", userId: null, email: null };
  }

  const tokenHash = hashVerificationToken(normalizedToken);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const token = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!token || token.usedAt) {
      return { status: "INVALID", userId: null, email: null };
    }

    if (token.expiresAt < now) {
      await tx.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });
      return { status: "EXPIRED", userId: token.userId, email: token.user.email };
    }

    if (token.user.emailVerifiedAt) {
      await tx.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });
      return { status: "ALREADY_VERIFIED", userId: token.userId, email: token.user.email };
    }

    await tx.emailVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    });

    await tx.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: now },
    });

    return { status: "VERIFIED", userId: token.userId, email: token.user.email };
  });
}
