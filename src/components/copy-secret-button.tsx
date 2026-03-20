"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopySecretButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button size="sm" variant="outline" onClick={() => void onCopy()}>
      {copied ? "Tersalin" : "Copy Item Digital"}
    </Button>
  );
}
