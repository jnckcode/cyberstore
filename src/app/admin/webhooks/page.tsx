"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WebhookLog = {
  id: number;
  nominal: number;
  timestamp: string;
  request_ip: string;
  validation_ok: boolean;
  process_status: string;
  error_message: string | null;
  transaction_id: number | null;
  created_at: string;
};

export default function AdminWebhooksPage() {
  const [rows, setRows] = useState<WebhookLog[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/webhooks");
    const data = (await response.json()) as WebhookLog[];
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Webhook Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>200 Event Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">#{row.id} - {row.process_status}</p>
              <p>
                Nominal: {row.nominal} | Validation: {String(row.validation_ok)} | Tx: {row.transaction_id ?? "-"}
              </p>
              <p>IP: {row.request_ip}</p>
              <p>At: {new Date(row.created_at).toLocaleString("id-ID")}</p>
              {row.error_message ? <p className="text-red-500">Error: {row.error_message}</p> : null}
            </div>
          ))}
          {rows.length === 0 ? <p className="text-muted-foreground">Belum ada log webhook.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
