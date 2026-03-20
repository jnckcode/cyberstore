import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const logs = await prisma.webhookEventLog.findMany({
    orderBy: {
      created_at: "desc"
    },
    take: 200
  });

  return NextResponse.json(logs);
}
