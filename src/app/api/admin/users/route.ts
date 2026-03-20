import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          transactions: true,
          ownedStock: true
        }
      }
    },
    orderBy: {
      id: "desc"
    }
  });

  return NextResponse.json(users);
}
