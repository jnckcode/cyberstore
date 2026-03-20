"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  id: number;
  email: string;
  role: "ADMIN" | "USER";
  is_verified: boolean;
  _count: { transactions: number; ownedStock: number };
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    const data = (await response.json()) as Row[];
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchUser = async (id: number, payload: Partial<Pick<Row, "role" | "is_verified">>) => {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      alert(data.error ?? "Update user gagal");
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Users</h1>
      <Card>
        <CardHeader>
          <CardTitle>Daftar User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">{row.email}</p>
              <p>
                Role: {row.role} | Verified: {String(row.is_verified)}
              </p>
              <p>
                Transactions: {row._count.transactions} | Owned stock: {row._count.ownedStock}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void patchUser(row.id, { role: "USER" })}>
                  Set USER
                </Button>
                <Button size="sm" variant="outline" onClick={() => void patchUser(row.id, { role: "ADMIN" })}>
                  Set ADMIN
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void patchUser(row.id, { is_verified: !row.is_verified })}
                >
                  Toggle Verified
                </Button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-muted-foreground">Belum ada user.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
