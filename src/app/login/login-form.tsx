"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";

type LoginFormProps = {
  demoAccess?: {
    email: string;
    password: string;
  } | null;
  initialEmail?: string;
  initialError?: string | null;
  nextPath: string;
};

export function LoginForm({
  demoAccess = null,
  initialEmail = "",
  initialError = null,
  nextPath,
}: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }

    if (!initialError) {
      return;
    }

    toast.error("Could not complete sign-in.");
  }, [initialEmail, initialError]);

  const handlePasswordSignIn = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address first.");
      return;
    }

    if (!password.trim()) {
      toast.error("Enter a password first.");
      return;
    }

    setIsSigningIn(true);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not sign in.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not sign in."));
      setIsSigningIn(false);
    }
  };

  const fillDemoCredentials = () => {
    if (!demoAccess) {
      return;
    }

    setEmail(demoAccess.email);
    setPassword(demoAccess.password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative">
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="relative w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <Link href="/" className="mb-8 inline-flex items-center justify-center">
            <BaseBuddyWordmark className="h-14 w-auto" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Access your projects and content.</p>
        </div>

        {demoAccess ? (
          <div className="mb-6 rounded-lg border border-primary/25 bg-primary/5 p-4 text-left">
            <div className="text-sm font-semibold text-foreground">Public demo access</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              This demo resets regularly. Use sample content only, not private data.
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-mono text-foreground">{demoAccess.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Password</span>
                <span className="font-mono text-foreground">{demoAccess.password}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={fillDemoCredentials}
              disabled={isSigningIn}
            >
              Fill demo credentials
            </Button>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-border"
              disabled={isSigningIn}
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-border"
              disabled={isSigningIn}
            />
          </div>
          <Button
            variant="hero"
            className="w-full"
            size="lg"
            onClick={handlePasswordSignIn}
            disabled={isSigningIn}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {isSigningIn ? "Signing in..." : "Sign in"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Use your BaseBuddy account email and password.
        </p>
      </div>
    </div>
  );
}
