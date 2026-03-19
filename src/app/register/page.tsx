"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegisterStage = "REGISTER" | "VERIFY" | "DONE";

export default function RegisterPage() {
  const [stage, setStage] = useState<RegisterStage>("REGISTER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const registerData = (await registerResponse.json()) as { error?: string };
      if (!registerResponse.ok) {
        throw new Error(registerData.error ?? "Registrasi gagal");
      }

      const otpResponse = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const otpData = (await otpResponse.json()) as { error?: string };
      if (!otpResponse.ok) {
        throw new Error(otpData.error ?? "Gagal kirim OTP");
      }

      setStage("VERIFY");
      setMessage("Akun berhasil dibuat. OTP sudah dikirim ke email kamu.");
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Terjadi kesalahan";
      setError(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Verifikasi OTP gagal");
      }

      setStage("DONE");
      setMessage("Email berhasil diverifikasi. Kamu sudah bisa login.");
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Terjadi kesalahan";
      setError(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Daftar CyberStore</CardTitle>
          <CardDescription>Buat akun baru lalu verifikasi email dengan OTP 6 digit.</CardDescription>
        </CardHeader>
        <CardContent>
          {stage === "REGISTER" ? (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button className="w-full" disabled={isLoading}>
                {isLoading ? "Membuat akun..." : "Daftar & Kirim OTP"}
              </Button>
            </form>
          ) : null}

          {stage === "VERIFY" ? (
            <form className="space-y-4" onSubmit={handleVerify}>
              <div className="space-y-1">
                <Label>OTP 6 Digit</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <Button className="w-full" disabled={isLoading || otp.length !== 6}>
                {isLoading ? "Memverifikasi..." : "Verifikasi OTP"}
              </Button>
            </form>
          ) : null}

          {stage === "DONE" ? (
            <div className="space-y-4">
              <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
              <Link href="/login" className="block">
                <Button className="w-full">Lanjut ke Login</Button>
              </Link>
            </div>
          ) : null}

          {message && stage !== "DONE" ? <p className="mt-4 text-sm text-green-600 dark:text-green-400">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

          <p className="mt-4 text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Login di sini
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
