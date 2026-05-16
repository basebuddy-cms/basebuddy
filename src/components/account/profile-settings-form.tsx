"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Lock, Upload } from "lucide-react";
import { toast } from "sonner";

import { getUserInitials } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/client";
import { MAX_AVATAR_UPLOAD_BYTES, validateImageUploadFile } from "@/lib/security/upload-validation";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileSettingsFormProps = {
  initialAvatarUrl: string | null;
  initialEmail: string | null;
  initialName: string;
};

type UpdateProfileResponse = {
  error?: string;
  profile?: {
    avatarUrl: string | null;
    email: string | null;
    name: string;
  };
};

export function ProfileSettingsForm({
  initialAvatarUrl,
  initialEmail,
  initialName,
}: ProfileSettingsFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [email] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmailLockedDialog, setShowEmailLockedDialog] = useState(false);
  const initials = getUserInitials(email);
  const displayedAvatarUrl = avatarPreviewUrl || avatarUrl;
  const hasChanges = name.trim() !== savedName || Boolean(selectedAvatarFile);

  useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedAvatarFile);
    setAvatarPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedAvatarFile]);

  const handleAvatarSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedAvatarFile(file);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast.error("Enter a profile name first.");
      return;
    }

    setIsSaving(true);

    try {
      let nextAvatarUrl: string | null | undefined;

      if (selectedAvatarFile) {
        const validation = await validateImageUploadFile({
          file: selectedAvatarFile,
          label: "Avatar image",
          maxBytes: MAX_AVATAR_UPLOAD_BYTES,
        });
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Please sign in to continue.");
        }

        const filePath = `${user.id}/avatar`;
        const avatarUploadBody =
          selectedAvatarFile.type === validation.contentType
            ? selectedAvatarFile
            : new File([selectedAvatarFile], selectedAvatarFile.name, { type: validation.contentType });
        const { error: uploadError } = await supabase.storage.from("profile_avatars").upload(filePath, avatarUploadBody, {
          cacheControl: "3600",
          contentType: validation.contentType,
          upsert: true,
        });

        if (uploadError) {
          throw new Error(
            getProductionErrorMessage(uploadError, "Could not upload your avatar right now."),
          );
        }

        nextAvatarUrl = supabase.storage.from("profile_avatars").getPublicUrl(filePath).data.publicUrl;
      }

      const response = await fetch("/api/profile", {
        body: JSON.stringify({
          avatarUrl: nextAvatarUrl,
          name: trimmedName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as UpdateProfileResponse;

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "Could not update your profile right now.");
      }

      setName(payload.profile.name);
      setSavedName(payload.profile.name);
      setAvatarUrl(payload.profile.avatarUrl);
      setSelectedAvatarFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast.success("Profile updated.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not update your profile right now."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 border border-border bg-secondary">
            {displayedAvatarUrl ? <AvatarImage src={displayedAvatarUrl} alt={name} /> : null}
            <AvatarFallback className="bg-secondary text-lg font-medium text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Avatar</p>
              <p className="text-xs text-muted-foreground">
                Upload a square image for your account menu and profile.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelection}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
            >
              <Upload className="h-3.5 w-3.5" />
              {selectedAvatarFile ? "Change avatar" : "Upload avatar"}
            </Button>
            {selectedAvatarFile ? (
              <p className="text-xs text-muted-foreground">{selectedAvatarFile.name}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-settings-name" className="text-xs font-medium uppercase tracking-wider">
            Name
          </Label>
          <Input
            id="profile-settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 border-border"
            maxLength={120}
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-settings-email" className="text-xs font-medium uppercase tracking-wider">
            Email
          </Label>
          <div className="relative">
            <Input
              id="profile-settings-email"
              value={email ?? ""}
              className="h-10 border-border pr-10"
              disabled
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowEmailLockedDialog(true)}
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="sr-only">Email is locked</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
          <div className="text-xs text-muted-foreground">
            {hasChanges ? "You have unsaved profile changes." : "Profile details are up to date."}
          </div>
          <Button
            type="button"
            variant="hero"
            size="sm"
            className="min-w-[112px]"
            onClick={() => void handleSubmit()}
            disabled={isSaving || !name.trim() || !hasChanges}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      <AlertDialog open={showEmailLockedDialog} onOpenChange={setShowEmailLockedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email cannot be changed.</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
