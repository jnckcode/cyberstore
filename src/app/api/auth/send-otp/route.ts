import { NextResponse } from "next/server";
import { z } from "zod";

import { generateOtpCode, saveOtpForEmail, sendOtpViaBrevo } from "@/lib/otp";

const requestSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const otp = generateOtpCode();
    await saveOtpForEmail(parsed.data.email, otp);
    await sendOtpViaBrevo({ email: parsed.data.email, otp });

    return NextResponse.json(
      {
        message: "OTP sent",
        ...(process.env.NODE_ENV !== "production" ? { otp } : {})
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
