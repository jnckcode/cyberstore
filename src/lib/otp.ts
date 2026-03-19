import { z } from "zod";
import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

const sendOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6)
});

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function saveOtpForEmail(email: string, otp: string) {
  const otpHash = await hash(otp, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.emailOtp.upsert({
    where: { email },
    create: {
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempt_count: 0
    },
    update: {
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempt_count: 0,
      created_at: new Date()
    }
  });
}

export async function verifyOtpForEmail(email: string, otp: string) {
  const record = await prisma.emailOtp.findUnique({ where: { email } });
  if (!record) {
    return false;
  }

  if (record.expires_at <= new Date() || record.attempt_count >= 5) {
    return false;
  }

  const isValid = await compare(otp, record.otp_hash);
  if (!isValid) {
    await prisma.emailOtp.update({
      where: { email },
      data: {
        attempt_count: {
          increment: 1
        }
      }
    });
    return false;
  }

  await prisma.emailOtp.delete({ where: { email } });
  return true;
}

export async function sendOtpViaBrevo(input: { email: string; otp: string }) {
  const parsed = sendOtpSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid OTP payload");
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    throw new Error("Brevo configuration missing");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: {
        email: senderEmail,
        name: "CyberStore"
      },
      to: [{ email: parsed.data.email }],
      subject: "Kode OTP Verifikasi CyberStore",
      htmlContent: `<p>Kode OTP kamu adalah <b>${parsed.data.otp}</b>. Berlaku 5 menit.</p>`
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Brevo send failed: ${details}`);
  }
}
