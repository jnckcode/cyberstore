import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logInvalidWebhookPayload, verifyAndAssignPayment } from "@/lib/payment-verifier";
import { getClientIp } from "@/lib/security";

const taskerPayloadSchema = z.object({
  message: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  notification: z.string().min(1).optional(),
  timestamp: z.number().int().optional(),
  signature: z.string().min(1).optional(),
  token: z.string().min(1).optional()
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

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/webhook/tasker/dana",
      method: "POST",
      expected_content_type: ["application/json", "application/x-www-form-urlencoded", "text/plain"],
      expected_fields: ["message", "timestamp", "signature(optional)", "token(optional)"]
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const requestIp = getClientIp(request);
  const contentType = request.headers.get("content-type") ?? "";
  let rawPayload: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    rawPayload = (await request.json()) as Record<string, unknown>;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      rawPayload[key] = String(value);
    }
  } else {
    const text = await request.text();
    rawPayload = { message: text };
  }

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

  const message =
    parsed.data.message ?? parsed.data.text ?? parsed.data.body ?? parsed.data.notification ?? "";
  const timestamp = parsed.data.timestamp ?? Date.now();

  const nominal = parseDanaMessageNominal(message);
  if (!nominal) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal: 0,
      timestamp,
      signature: String(parsed.data.signature ?? "missing"),
      requestIp,
      errorMessage: "Cannot parse nominal from notification message"
    });

    return NextResponse.json({ error: "Nominal not found in notification message" }, { status: 400 });
  }

  const taskerTokenHeader = request.headers.get("x-tasker-token");
  const taskerTokenQuery = new URL(request.url).searchParams.get("token");
  const taskerToken = process.env.TASKER_PROFILE_TOKEN?.trim();
  const tokenCandidate = taskerTokenHeader ?? parsed.data.token ?? taskerTokenQuery ?? "";
  const tokenAuthorized = Boolean(taskerToken && tokenCandidate && tokenCandidate === taskerToken);

  const signature = parsed.data.signature;
  if (!signature && !tokenAuthorized) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal,
      timestamp,
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
          .update(String(nominal) + String(timestamp) + process.env.TASKER_SECRET)
          .digest("hex")
      : "");

  if (!finalSignature) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const result = await verifyAndAssignPayment({
    nominal,
    timestamp,
    signature: finalSignature,
    requestIp,
    source: "TASKER_DANA"
  });

  return NextResponse.json(result.body, { status: result.status });
}
