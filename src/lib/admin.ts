import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdminApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (session.user.role !== "ADMIN") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, adminId: Number(session.user.id), session };
}

export async function writeAdminAuditLog(input: {
  adminUserId: number;
  action: string;
  targetType: string;
  targetId?: number;
  details?: string;
}) {
  await prisma.adminAuditLog.create({
    data: {
      admin_user_id: input.adminUserId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      details: input.details
    }
  });
}
