import { NextResponse } from "next/server";
import { z } from "zod";

import { generateOtpCode, saveOtpForEmail, sendOtpViaBrevo } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security";

const requestSchema = z.object({
  email: z.string().email()
});

const OTP_EMAIL_LIMIT_PER_HOUR = 5;
const OTP_IP_LIMIT_PER_HOUR = 20;
const OTP_RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const ipAddress = getClientIp(request);

    const [user, otpRecord, emailRequestCount, ipRequestCount] = await Promise.all([
      prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
      prisma.emailOtp.findUnique({ where: { email: parsed.data.email } }),
      prisma.otpRequestLog.count({
        where: {
          email: parsed.data.email,
          created_at: { gte: oneHourAgo }
        }
      }),
      prisma.otpRequestLog.count({
        where: {
          ip_address: ipAddress,
          created_at: { gte: oneHourAgo }
        }
      })
    ]);

    if (emailRequestCount >= OTP_EMAIL_LIMIT_PER_HOUR || ipRequestCount >= OTP_IP_LIMIT_PER_HOUR) {
      return NextResponse.json({ error: "Too many OTP requests" }, { status: 429 });
    }

    if (otpRecord && now.getTime() - otpRecord.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: "Please wait before requesting new OTP" }, { status: 429 });
    }

    if (!user) {
      await prisma.otpRequestLog.create({
        data: {
          email: parsed.data.email,
          ip_address: ipAddress
        }
      });

      return NextResponse.json({ message: "If email is eligible, OTP has been sent" }, { status: 200 });
    }

    const otp = generateOtpCode();
    await saveOtpForEmail(parsed.data.email, otp);
    await sendOtpViaBrevo({ email: parsed.data.email, otp });
    await prisma.otpRequestLog.create({
      data: {
        email: parsed.data.email,
        ip_address: ipAddress
      }
    });

    return NextResponse.json(
      {
        message: "If email is eligible, OTP has been sent",
        ...(process.env.NODE_ENV !== "production" ? { otp } : {})
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
