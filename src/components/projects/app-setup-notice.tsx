import Link from "next/link";
import React from "react";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_SETUP_REQUIRED_MESSAGE } from "@/lib/control-plane/server";

type AppSetupNoticeProps = {
  ctaHref?: string;
  ctaLabel?: string;
  title?: string;
};

export function AppSetupNotice({
  ctaHref,
  ctaLabel,
  title = "Finish setup to continue",
}: AppSetupNoticeProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
          <Wrench className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{APP_SETUP_REQUIRED_MESSAGE}</p>
          {ctaHref && ctaLabel ? (
            <Button variant="hero" size="sm" className="mt-5" asChild>
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
