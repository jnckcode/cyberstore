"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuditLog = {
  id: number;
  action: string;
  target_type: string;
  target_id: number | null;
  details: string | null;
  created_at: string;
  admin: { email: string };
};

export default function AdminAuditsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/audits");
    const data = (await response.json()) as AuditLog[];
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Audit Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>200 Audit Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">#{row.id} - {row.action}</p>
              <p>
                Admin: {row.admin.email} | Target: {row.target_type}#{row.target_id ?? "-"}
              </p>
              <p>At: {new Date(row.created_at).toLocaleString("id-ID")}</p>
              {row.details ? <p className="text-muted-foreground">Details: {row.details}</p> : null}
            </div>
          ))}
          {rows.length === 0 ? <p className="text-muted-foreground">Belum ada audit log.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
