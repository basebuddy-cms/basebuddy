import { BaseBuddyWordmark } from "@/components/basebuddy-mark";

export function OnboardingShell() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex h-14 items-center">
              <BaseBuddyWordmark className="h-10 w-auto" />
            </div>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-foreground">Setup</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-2xl px-6 py-16">
        <div className="mb-12 flex items-center justify-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              1
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-foreground">Setup</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-48 rounded bg-secondary animate-pulse" />
            <div className="mx-auto h-4 w-80 rounded bg-secondary/80 animate-pulse" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="h-10 rounded-lg bg-secondary animate-pulse" />
              <div className="h-10 rounded-lg bg-secondary animate-pulse" />
              <div className="h-10 rounded-lg bg-secondary animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
