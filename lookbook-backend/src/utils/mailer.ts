import nodemailer from "nodemailer";
import { env } from "../config/env";
import { User } from "../models/User";
import type { IEmailPreferences } from "../models/User";

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : null;

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export const sendMail = async ({ to, subject, html }: SendMailInput): Promise<void> => {
  // Always log locally so the flow is testable without a real inbox — this
  // is dev convenience, not a replacement for actually sending the email.
  if (!env.isProd) {
    // eslint-disable-next-line no-console
    console.log(`[mailer] -> ${to} | ${subject}\n${html}`);
  }

  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn("[mailer] SMTP not configured — email not sent, see console log above.");
    return;
  }

  await transporter.sendMail({ from: env.smtp.from, to, subject, html });
};

/** Gate for the category-based email preferences (future.md's Feature 9).
 * Only for non-security emails — verification, password reset, and 2FA
 * emails always send regardless of preference. Defaults to true (opt-in by
 * default, and safe for accounts created before this field existed — the
 * schema default backfills it on read even for un-migrated documents). */
export const shouldSendEmail = async (
  userId: string,
  category: keyof IEmailPreferences
): Promise<boolean> => {
  const user = await User.findById(userId).select("emailPreferences");
  if (!user) return false;
  const pref = user.emailPreferences?.[category];
  if (pref === false) {
    // eslint-disable-next-line no-console
    console.log(`[mailer] Skipping ${category} email for user ${userId} — preference disabled.`);
    return false;
  }
  return true;
};

export const buildVerifyEmailHtml = (link: string) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Verify your LookBook email</h2>
    <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
    <p><a href="${link}" style="color:#d97706;">${link}</a></p>
  </div>
`;

export const buildResetPasswordHtml = (link: string) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Reset your LookBook password</h2>
    <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
    <p><a href="${link}" style="color:#d97706;">${link}</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  </div>
`;

export const buildOrderConfirmationHtml = (orderItems: { title: string; mode: string; price: number }[], total: number) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Your LookBook order is confirmed</h2>
    <ul>
      ${orderItems.map((i) => `<li>${i.title} (${i.mode}) — ₹${i.price}</li>`).join("")}
    </ul>
    <p><strong>Total: ₹${total}</strong></p>
  </div>
`;

export const buildRefundHtml = (amount: number) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Your refund has been processed</h2>
    <p>₹${amount} has been refunded to your original payment method. It may take a few business days to reflect.</p>
  </div>
`;

export const buildPriceDropHtml = (title: string, oldPrice: number, newPrice: number, link: string) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Price drop on a book you wishlisted</h2>
    <p><strong>${title}</strong> dropped from ₹${oldPrice} to ₹${newPrice}.</p>
    <p><a href="${link}" style="color:#d97706;">View the book</a></p>
  </div>
`;
