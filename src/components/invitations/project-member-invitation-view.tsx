"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LogOut, Mail, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getProjectMemberInvitationRecipientState,
  type ProjectMemberInvitationPreview,
} from "@/lib/control-plane/member-invitations";
import { formatProjectDate } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/client";

type ProjectMemberInvitationViewProps = {
  accountEmail: string | null;
  loginPath: string;
  preview: ProjectMemberInvitationPreview;
  publicToken: string;
};

const InvitationStatusBanner = ({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) => (
  <Alert className="border-border bg-secondary/40">
    {icon}
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{description}</AlertDescription>
  </Alert>
);

export function ProjectMemberInvitationView({
  accountEmail,
  loginPath,
  preview,
  publicToken,
}: ProjectMemberInvitationViewProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const recipientState = getProjectMemberInvitationRecipientState({
    currentUserEmail: accountEmail,
    invitedEmail: preview.invitedEmail,
  });

  const handleAccept = async () => {
    if (accepting) {
      return;
    }

    setAccepting(true);

    try {
      const response = await fetch(`/api/member-invitations/${encodeURIComponent(publicToken)}`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
        status?: "accepted" | "already_member";
      };

      if (!response.ok || !payload.redirectTo || !payload.status) {
        throw new Error(payload.error || "Could not accept this invitation right now.");
      }

      toast.success(
        payload.status === "already_member"
          ? "You already had access to this project."
          : "Invitation accepted.",
      );
      router.replace(payload.redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not accept this invitation right now."));
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    if (switchingAccount) {
      return;
    }

    setSwitchingAccount(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.assign(loginPath);
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not switch accounts right now."));
      setSwitchingAccount(false);
    }
  };

  const isInvitationAccepted = preview.status === "accepted";
  const isInvitationExpired = preview.status === "expired";
  const isInvitationRevoked = preview.status === "revoked";

  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Project Invitation
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Join {preview.projectName}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This invite is reserved for <span className="font-medium text-foreground">{preview.invitedEmail}</span>.
            You&apos;ll need to sign in with that exact email address before you can accept.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Treat this invite link like a key to this project. Only share it with the invited person.
          </p>
        </div>
      </div>

      <div className="space-y-4 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          {preview.roles.map((role) => (
            <Badge key={role} variant="secondary" className="capitalize">
              {role}
            </Badge>
          ))}
          {preview.authorScopes.length ? (
            <Badge variant="outline">
              {preview.authorScopes.length} author scope{preview.authorScopes.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project</p>
            <p className="mt-1 text-foreground">{preview.projectName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</p>
            <p className="mt-1 text-foreground">{formatProjectDate(preview.expiresAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invited Email</p>
            <p className="mt-1 text-foreground">{preview.invitedEmail}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Account</p>
            <p className="mt-1 text-foreground">{accountEmail ?? "Not signed in"}</p>
          </div>
        </div>
      </div>

      {isInvitationRevoked ? (
        <InvitationStatusBanner
          icon={<XCircle className="h-4 w-4" />}
          title="This invite was revoked"
          description="Ask a project owner or admin to create a new invitation link for you."
        />
      ) : null}

      {isInvitationExpired ? (
        <InvitationStatusBanner
          icon={<AlertCircle className="h-4 w-4" />}
          title="This invite expired"
          description="Ask a project owner or admin to send you a fresh invitation link."
        />
      ) : null}

      {isInvitationAccepted ? (
        <InvitationStatusBanner
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="This invite has already been accepted"
          description="If you accepted it earlier, sign in with the invited email address to open the project again."
        />
      ) : null}

      {!isInvitationAccepted && !isInvitationExpired && !isInvitationRevoked && recipientState === "ready" ? (
        <Alert className="border-border bg-secondary/40">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Ready to join</AlertTitle>
          <AlertDescription>
            You&apos;re signed in with the invited email. Accepting will add you to this project with the roles shown above.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isInvitationExpired && !isInvitationRevoked && recipientState === "needs_auth" ? (
        <Alert className="border-border bg-secondary/40">
          <Mail className="h-4 w-4" />
          <AlertTitle>Sign in or create your account first</AlertTitle>
          <AlertDescription>
            BaseBuddy will send a one-time login link, and you&apos;ll come straight back to this invitation after you verify it.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isInvitationExpired && !isInvitationRevoked && recipientState === "wrong_account" ? (
        <Alert className="border-border bg-secondary/40">
          <UserPlus className="h-4 w-4" />
          <AlertTitle>Wrong account</AlertTitle>
          <AlertDescription>
            This invite is for {preview.invitedEmail}. You&apos;re currently signed in as {accountEmail ?? "a different account"}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        {!isInvitationExpired && !isInvitationRevoked && recipientState === "needs_auth" ? (
          <Button variant="hero" asChild>
            <Link href={loginPath}>Sign in with invited email</Link>
          </Button>
        ) : null}

        {!isInvitationExpired && !isInvitationRevoked && recipientState === "wrong_account" ? (
          <Button variant="hero" onClick={() => void handleSwitchAccount()} disabled={switchingAccount}>
            {switchingAccount ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Switch account
              </>
            )}
          </Button>
        ) : null}

        {!isInvitationAccepted && !isInvitationExpired && !isInvitationRevoked && recipientState === "ready" ? (
          <Button variant="hero" onClick={() => void handleAccept()} disabled={accepting}>
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept invitation"
            )}
          </Button>
        ) : null}

        {isInvitationAccepted ? (
          recipientState === "ready" ? (
            <Button variant="hero" asChild>
              <Link href={`/projects/${preview.projectSlug}`}>Open project</Link>
            </Button>
          ) : (
            <Button variant="hero" asChild>
              <Link href={loginPath}>Sign in with invited email</Link>
            </Button>
          )
        ) : null}

        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
