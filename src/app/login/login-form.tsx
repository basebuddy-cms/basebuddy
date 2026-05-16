"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  DEFAULT_INSTALL_AUTH_PROVIDERS,
  type InstallAuthProvider,
} from "@/lib/self-host/auth-provider-options";
import { buildBrowserRedirectUrl } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { Github, KeyRound, Mail } from "lucide-react";

type LoginFormProps = {
  enabledProviders?: InstallAuthProvider[];
  initialEmail?: string;
  initialError?: string | null;
  nextPath: string;
};

export function LoginForm({
  enabledProviders = DEFAULT_INSTALL_AUTH_PROVIDERS,
  initialEmail = "",
  initialError = null,
  nextPath,
}: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"github" | "google" | "email" | "password" | null>(null);
  const router = useRouter();
  const canUseGithub = enabledProviders.includes("github");
  const canUseGoogle = enabledProviders.includes("google");
  const canUseMagicLink = enabledProviders.includes("magic_link");
  const canUsePassword = enabledProviders.includes("password");
  const hasOauthProviders = canUseGithub || canUseGoogle;
  const hasEmailProviders = canUseMagicLink || canUsePassword;

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }

    if (!initialError) {
      return;
    }

    if (initialError === "auth_callback_error") {
      toast.error("Could not complete sign-in.");
      return;
    }

    if (initialError === "email_confirm_error") {
      toast.error("Could not verify the email sign-in link.");
    }
  }, [initialEmail, initialError]);

  const signInWithProvider = async (provider: "github" | "google") => {
    try {
      setPendingAction(provider);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildBrowserRedirectUrl(`/auth/callback?next=${encodeURIComponent(nextPath)}`),
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not start sign-in."));
      setPendingAction(null);
    }
  };

  const signInWithEmail = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address first.");
      return;
    }

    try {
      setPendingAction("email");

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: buildBrowserRedirectUrl(`/auth/confirm?next=${encodeURIComponent(nextPath)}`),
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Check your email for the sign-in link.");
      setEmail("");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not send the sign-in link."));
    } finally {
      setPendingAction(null);
    }
  };

  const signInWithPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address first.");
      return;
    }

    if (!password.trim()) {
      toast.error("Enter a password first.");
      return;
    }

    try {
      setPendingAction("password");

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.replace(nextPath);
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not sign in with email and password."));
    } finally {
      setPendingAction(null);
    }
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
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your self-hosted workspace</p>
        </div>

        {hasOauthProviders ? (
          <div className="space-y-3">
            {canUseGithub ? (
              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                size="lg"
                onClick={() => signInWithProvider("github")}
                disabled={pendingAction !== null}
              >
                <Github className="h-4 w-4" />
                Continue with GitHub
              </Button>
            ) : null}
            {canUseGoogle ? (
              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                size="lg"
                onClick={() => signInWithProvider("google")}
                disabled={pendingAction !== null}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            ) : null}
          </div>
        ) : null}

        {hasOauthProviders && hasEmailProviders ? (
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        ) : null}

        {hasEmailProviders ? (
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
            />
          </div>
          {canUsePassword ? (
            <>
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
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={signInWithPassword}
                disabled={pendingAction !== null}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Sign in with Password
              </Button>
            </>
          ) : null}
          {canUseMagicLink ? (
            <Button
              variant="hero"
              className="w-full"
              size="lg"
              onClick={signInWithEmail}
              disabled={pendingAction !== null}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email me a Sign-In Link
            </Button>
          ) : null}
        </div>
        ) : (
          <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            No sign-in methods are enabled yet. Open setup and choose at least one method before
            inviting users.
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Use your install account password, or request a sign-in link if email delivery is configured.
        </p>
      </div>
    </div>
  );
}
