import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export async function GET(_request: Request, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: parsed.data.id
    },
    select: {
      id: true,
      status: true,
      total_price: true,
      expires_at: true,
      user_id: true
    }
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.user_id !== Number(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (transaction.status === "PENDING" && transaction.expires_at <= new Date()) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "EXPIRED" }
    });

    return NextResponse.json(
      {
        id: transaction.id,
        status: "EXPIRED",
        total_price: transaction.total_price,
        expires_at: transaction.expires_at
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      id: transaction.id,
      status: transaction.status,
      total_price: transaction.total_price,
      expires_at: transaction.expires_at
    },
    { status: 200 }
  );
}
