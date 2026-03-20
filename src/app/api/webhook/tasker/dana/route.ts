import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logInvalidWebhookPayload, verifyAndAssignPayment } from "@/lib/payment-verifier";
import { getClientIp } from "@/lib/security";

const taskerPayloadSchema = z.object({
  message: z.string().min(1),
  timestamp: z.number().int(),
  signature: z.string().min(1).optional()
});

function parseDanaMessageNominal(message: string) {
  const match = message.match(/Rp\s*([\d.,]+)/i);
  if (!match) {
    return null;
  }

  const numeric = match[1].replace(/\./g, "").replace(/,/g, ".");
  const amount = Number.parseFloat(numeric);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount);
}

export async function POST(request: Request) {
  const requestIp = getClientIp(request);
  const rawPayload = await request.json();
  const parsed = taskerPayloadSchema.safeParse(rawPayload);

  if (!parsed.success) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal: 0,
      timestamp: Number(rawPayload?.timestamp ?? 0),
      signature: String(rawPayload?.signature ?? "invalid"),
      requestIp,
      errorMessage: "Invalid payload format"
    });

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const nominal = parseDanaMessageNominal(parsed.data.message);
  if (!nominal) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal: 0,
      timestamp: parsed.data.timestamp,
      signature: String(parsed.data.signature ?? "missing"),
      requestIp,
      errorMessage: "Cannot parse nominal from notification message"
    });

    return NextResponse.json({ error: "Nominal not found in notification message" }, { status: 400 });
  }

  const taskerTokenHeader = request.headers.get("x-tasker-token");
  const taskerToken = process.env.TASKER_PROFILE_TOKEN?.trim();
  const tokenAuthorized = Boolean(taskerToken && taskerTokenHeader && taskerTokenHeader === taskerToken);

  const signature = parsed.data.signature;
  if (!signature && !tokenAuthorized) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal,
      timestamp: parsed.data.timestamp,
      signature: "missing",
      requestIp,
      errorMessage: "Missing signature and invalid tasker token"
    });

    return NextResponse.json({ error: "Unauthorized tasker callback" }, { status: 401 });
  }

  const finalSignature =
    signature ??
    (process.env.TASKER_SECRET
      ? createHash("sha256")
          .update(String(nominal) + String(parsed.data.timestamp) + process.env.TASKER_SECRET)
          .digest("hex")
      : "");

  if (!finalSignature) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const result = await verifyAndAssignPayment({
    nominal,
    timestamp: parsed.data.timestamp,
    signature: finalSignature,
    requestIp,
    source: "TASKER_DANA"
  });

  return NextResponse.json(result.body, { status: result.status });
}
