import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

const querySchema = z.object({
  status: z.enum(["PENDING", "PAID", "EXPIRED"]).optional(),
  userEmail: z.string().email().optional()
});

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    userEmail: url.searchParams.get("userEmail") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      status: parsed.data.status,
      user: parsed.data.userEmail ? { email: parsed.data.userEmail } : undefined
    },
    include: {
      user: true,
      product: true,
      stock: true
    },
    orderBy: {
      created_at: "desc"
    },
    take: 300
  });

  return NextResponse.json(transactions);
}
