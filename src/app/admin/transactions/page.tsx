"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Row = {
  id: number;
  status: "PENDING" | "PAID" | "EXPIRED";
  total_price: number;
  created_at: string;
  user: { email: string };
  product: { title: string };
};

export default function AdminTransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    if (email) {
      params.set("userEmail", email);
    }

    const response = await fetch(`/api/admin/transactions?${params.toString()}`);
    const data = (await response.json()) as Row[];
    setRows(data);
  }, [email, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setTxStatus = async (id: number, next: "PENDING" | "PAID" | "EXPIRED") => {
    await fetch(`/api/admin/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next })
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Transactions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <select
            className="h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Semua status</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
          <Input placeholder="User email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button variant="outline" onClick={() => void load()}>
            Terapkan
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStatus("");
              setEmail("");
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">
                #{row.id} - {row.product.title}
              </p>
              <p>User: {row.user.email}</p>
              <p>Total: Rp {row.total_price.toLocaleString("id-ID")}</p>
              <p>Status: {row.status}</p>
              <p>Dibuat: {new Date(row.created_at).toLocaleString("id-ID")}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void setTxStatus(row.id, "PENDING")}>
                  Set PENDING
                </Button>
                <Button size="sm" variant="outline" onClick={() => void setTxStatus(row.id, "PAID")}>
                  Set PAID
                </Button>
                <Button size="sm" variant="outline" onClick={() => void setTxStatus(row.id, "EXPIRED")}>
                  Set EXPIRED
                </Button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-muted-foreground">Tidak ada transaksi.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
