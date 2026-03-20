import type { DefaultSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { consumeMemoryRateLimit } from "@/lib/security";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "USER";
    isVerified: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "USER";
      isVerified: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "ADMIN" | "USER";
    isVerified?: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const normalizedEmail = parsed.data.email.trim().toLowerCase();
        const loginLimit = consumeMemoryRateLimit(`login:${normalizedEmail}`, 10, 10 * 60 * 1000);
        if (!loginLimit.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail }
        });

        if (!user) {
          return null;
        }

        const isValidPassword = await compare(parsed.data.password, user.password_hash);
        if (!isValidPassword) {
          return null;
        }

        if (!user.is_verified) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          role: user.role,
          isVerified: user.is_verified
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.isVerified = user.isVerified;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.role = token.role ?? "USER";
        session.user.isVerified = token.isVerified ?? false;
      }

      return session;
    }
  }
};
