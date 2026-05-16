export type SlugState = {
  detail: string;
  normalizedSlug: string;
  status: "available" | "checking" | "idle" | "invalid" | "taken";
};

export const OLD_PROJECT_CREATION_DRAFT_KEYS = [
  "basebuddy:onboarding-draft",
  "supapress:onboarding-draft",
] as const;

export const getSlugStateToneClass = (status: SlugState["status"]) => {
  switch (status) {
    case "available":
      return "text-success";
    case "invalid":
    case "taken":
      return "text-destructive";
    case "checking":
      return "text-muted-foreground";
    case "idle":
    default:
      return "text-muted-foreground";
  }
};
