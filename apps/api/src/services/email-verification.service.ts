import { randomBytes } from 'node:crypto';

import { AuthProvider, EmailTokenPurpose, prisma } from '@taskflow/db';
import bcrypt from 'bcryptjs';

import { getJwtSecret } from '../lib/env.js';
import { AppError } from '../lib/errors.js';
import { toUserProfile } from '../lib/http.js';
import { signUserJwt } from '../lib/jwt.js';
import { sendEmail } from '../lib/mailer.js';

import { createUserWithPersonalClass, type RegisterInput } from './auth.service.js';
import { getConfigValue } from './system-config.service.js';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX = 5;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SALT_ROUNDS = 10;

// ── Token CRUD ──────────────────────────────────────────────────────────────

async function createVerificationToken(
  email: string,
  purpose: EmailTokenPurpose,
  userId?: string,
): Promise<string> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await prisma.emailVerificationToken.count({
    where: { email, purpose, createdAt: { gte: windowStart } },
  });

  if (count >= RATE_LIMIT_MAX) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Too many verification emails for this address. Please try again later.',
    );
  }

  const token = randomBytes(32).toString('hex');

  await prisma.emailVerificationToken.create({
    data: {
      email,
      token,
      purpose,
      userId: userId ?? null,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    },
  });

  return token;
}

async function validateToken(token: string, purpose: EmailTokenPurpose) {
  const row = await prisma.emailVerificationToken.findUnique({ where: { token } });

  if (!row || row.purpose !== purpose || row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, 'INVALID_TOKEN', 'Token is invalid or expired');
  }

  return row;
}

async function consumeToken(tokenId: string, email: string, purpose: EmailTokenPurpose) {
  await prisma.emailVerificationToken.deleteMany({
    where: { email, purpose },
  });
  // tokenId's row is included in the batch delete above
}

// ── Email templates ─────────────────────────────────────────────────────────

function buildVerificationHtml(
  heading: string,
  bodyText: string,
  ctaLabel: string,
  ctaUrl: string,
) {
  const accentColor = '#7B6CB0';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#fffdf8;border-radius:8px;overflow:hidden;border:1px solid #e8e2d8;">
        <tr><td style="height:4px;background-color:${accentColor};"></td></tr>
        <tr><td style="padding:24px 32px 16px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8078;">TaskFlow</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#2c2825;">${heading}</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#2c2825;">${bodyText}</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;" align="center">
          <a href="${ctaUrl}" style="display:inline-block;padding:10px 28px;background-color:${accentColor};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e8e2d8;">
          <p style="margin:0;font-size:12px;color:#c0b8ad;text-align:center;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Registration flow ───────────────────────────────────────────────────────

export async function sendRegistrationEmail(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
  }

  const token = await createVerificationToken(email, EmailTokenPurpose.REGISTRATION);
  const baseUrl = (await getConfigValue('app.base_url')) || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/register/complete?token=${token}`;

  const subject = '[TaskFlow] Verify your email';
  const text = `Click the following link to verify your email and complete registration:\n\n${verifyUrl}\n\nThis link expires in 1 hour.`;
  const html = buildVerificationHtml(
    'Verify your email',
    'Click the button below to verify your email and complete your TaskFlow registration.',
    'Verify Email',
    verifyUrl,
  );

  await sendEmail(email, subject, text, html);
}

export async function verifyRegistrationToken(token: string) {
  const row = await validateToken(token, EmailTokenPurpose.REGISTRATION);

  // Check email hasn't been taken while token was pending
  const existing = await prisma.user.findUnique({ where: { email: row.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
  }

  return { valid: true, email: row.email };
}

export async function completeRegistration(
  token: string,
  input: Omit<RegisterInput, 'email'>,
) {
  const row = await validateToken(token, EmailTokenPurpose.REGISTRATION);

  const result = await createUserWithPersonalClass({
    email: row.email,
    ...input,
  });

  await consumeToken(row.id, row.email, EmailTokenPurpose.REGISTRATION);

  return result;
}

// ── Password reset flow ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Silent return — do not reveal whether email exists
  if (!user) {
    return;
  }

  const token = await createVerificationToken(email, EmailTokenPurpose.PASSWORD_RESET, user.id);
  const baseUrl = (await getConfigValue('app.base_url')) || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const subject = '[TaskFlow] Reset your password';
  const text = `Click the following link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`;
  const html = buildVerificationHtml(
    'Reset your password',
    'Click the button below to set a new password for your TaskFlow account.',
    'Reset Password',
    resetUrl,
  );

  await sendEmail(email, subject, text, html);
}

export async function verifyPasswordResetToken(token: string) {
  const row = await validateToken(token, EmailTokenPurpose.PASSWORD_RESET);
  return { valid: true, email: row.email };
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await validateToken(token, EmailTokenPurpose.PASSWORD_RESET);

  if (!row.userId) {
    throw new AppError(400, 'INVALID_TOKEN', 'Token is invalid');
  }

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    include: { school: { select: { name: true } } },
  });

  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'User not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.userCredential.updateMany({
    where: { userId: row.userId, provider: AuthProvider.LOCAL },
    data: { passwordHash },
  });

  await consumeToken(row.id, row.email, EmailTokenPurpose.PASSWORD_RESET);

  return {
    token: signUserJwt({ sub: user.id, email: user.email }, getJwtSecret()),
    user: toUserProfile(user),
  };
}

// ── Email change flow ───────────────────────────────────────────────────────

export async function sendEmailChangeVerification(userId: string, newEmail: string) {
  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email already in use');
  }

  const token = await createVerificationToken(newEmail, EmailTokenPurpose.EMAIL_CHANGE, userId);
  const baseUrl = (await getConfigValue('app.base_url')) || 'http://localhost:3000';
  const confirmUrl = `${baseUrl}/settings/verify-email?token=${token}`;

  const subject = '[TaskFlow] Confirm your new email';
  const text = `Click the following link to confirm changing your email to ${newEmail}:\n\n${confirmUrl}\n\nThis link expires in 1 hour.`;
  const html = buildVerificationHtml(
    'Confirm your new email',
    `Click the button below to confirm changing your TaskFlow email to <strong>${escapeHtml(newEmail)}</strong>.`,
    'Confirm Email Change',
    confirmUrl,
  );

  await sendEmail(newEmail, subject, text, html);
}

export async function confirmEmailChange(token: string, authenticatedUserId: string) {
  const row = await validateToken(token, EmailTokenPurpose.EMAIL_CHANGE);

  if (!row.userId || row.userId !== authenticatedUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Token does not match authenticated user');
  }

  // Check email still available (race condition guard)
  const existing = await prisma.user.findUnique({ where: { email: row.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email already in use');
  }

  const user = await prisma.user.update({
    where: { id: row.userId },
    data: { email: row.email },
    include: { school: { select: { name: true } } },
  });

  await consumeToken(row.id, row.email, EmailTokenPurpose.EMAIL_CHANGE);

  return toUserProfile(user);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
