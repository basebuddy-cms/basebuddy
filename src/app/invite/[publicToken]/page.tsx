import Link from "next/link";

import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { ProjectMemberInvitationView } from "@/components/invitations/project-member-invitation-view";
import { Button } from "@/components/ui/button";
import { getOptionalAuthenticatedUserWithAccount } from "@/lib/control-plane/server";
import {
  buildProjectMemberInvitationLoginPath,
} from "@/lib/control-plane/member-invitations";
import { getProjectMemberInvitationPreview } from "@/lib/control-plane/member-invitations-server";

type ProjectInvitationPageProps = {
  params: Promise<{ publicToken: string }>;
};

export default async function ProjectInvitationPage({ params }: ProjectInvitationPageProps) {
  const { publicToken } = await params;
  const [preview, auth] = await Promise.all([
    getProjectMemberInvitationPreview(publicToken),
    getOptionalAuthenticatedUserWithAccount(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="mb-12 flex items-center justify-between gap-4 border-b border-border pb-6">
          <Link href="/" className="inline-flex items-center">
            <BaseBuddyWordmark className="h-7 w-auto" />
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href={auth.user ? "/projects" : "/login"}>{auth.user ? "Projects" : "Sign in"}</Link>
          </Button>
        </div>

        {!preview ? (
          <div className="max-w-xl space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Project Invitation
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invitation not found</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                This invitation link is missing, invalid, or no longer available. Ask a project owner or admin to create a fresh invite for you.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="hero" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ProjectMemberInvitationView
            accountEmail={auth.account?.email ?? auth.user?.email ?? null}
            loginPath={buildProjectMemberInvitationLoginPath(publicToken, preview.invitedEmail)}
            preview={preview}
            publicToken={publicToken}
          />
        )}
      </div>
    </div>
  );
}
