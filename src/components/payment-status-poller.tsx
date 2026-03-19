"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch transaction status");
  }

  return (await response.json()) as {
    status: "PENDING" | "PAID" | "EXPIRED";
  };
};

export function PaymentStatusPoller({ transactionId }: { transactionId: number }) {
  const router = useRouter();
  const { data } = useSWR(`/api/transactions/${transactionId}/status`, fetcher, {
    refreshInterval: (latest) => {
      if (latest?.status === "PAID" || latest?.status === "EXPIRED") {
        return 0;
      }

      return 3000;
    },
    revalidateOnFocus: true
  });

  useEffect(() => {
    if (data?.status === "PAID") {
      router.replace("/dashboard");
    }
  }, [data?.status, router]);

  return (
    <p className="text-sm text-muted-foreground">
      Status pembayaran: <span className="font-semibold text-foreground">{data?.status ?? "PENDING"}</span>
      {data?.status === "EXPIRED" ? " (transaksi kedaluwarsa)" : ""}
    </p>
  );
}
