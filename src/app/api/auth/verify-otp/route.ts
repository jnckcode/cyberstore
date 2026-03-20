import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { consumeMemoryRateLimit, getClientIp } from "@/lib/security";
import { verifyOtpForEmail } from "@/lib/otp";

const payloadSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6)
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeMemoryRateLimit(`verify-otp:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec)
        }
      }
    );
  }

  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ok = await verifyOtpForEmail(parsed.data.email, parsed.data.otp);
  if (!ok) {
    return NextResponse.json({ error: "OTP invalid or expired" }, { status: 400 });
  }

  await prisma.user.updateMany({
    where: { email: parsed.data.email },
    data: { is_verified: true }
  });

  return NextResponse.json({ message: "Email verified" }, { status: 200 });
}
