import Link from "next/link";

import { ProfileSettingsForm } from "@/components/account/profile-settings-form";
import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { AppSetupNotice } from "@/components/projects/app-setup-notice";
import {
  getProfileSettingsPageBootstrap,
} from "@/lib/control-plane/server";

export default async function ProfileSettingsPage() {
  const profileResult = await getProfileSettingsPageBootstrap();

  if (profileResult.setupRequired) {
    return (
      <div className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <AppSetupNotice ctaHref="/" ctaLabel="Back to home" />
        </div>
      </div>
    );
  }

  if (profileResult.errorMessage) {
    return (
      <div className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {profileResult.errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex h-14 items-center">
              <BaseBuddyWordmark className="h-10 w-auto" />
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-foreground">Profile Settings</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your display name and avatar.
          </p>
        </div>

        <ProfileSettingsForm
          initialAvatarUrl={profileResult.avatarUrl}
          initialEmail={profileResult.email}
          initialName={profileResult.name}
        />
      </div>
    </div>
  );
}
