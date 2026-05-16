"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectMediaManagerSkeleton() {
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>

            <div className="flex w-full max-w-md items-center gap-3">
              <Skeleton className="h-10 flex-1 rounded-md" />
              <Skeleton className="h-10 w-28 rounded-md" />
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>

          <div className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={`media-folder-skeleton-${index}`} className="border-border bg-card">
                  <CardContent className="grid min-h-[128px] grid-cols-[120px_minmax(0,1fr)] p-0">
                    <div className="border-r border-border p-3">
                      <Skeleton className="h-full min-h-[94px] w-full rounded-md" />
                    </div>
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Card key={`media-image-skeleton-${index}`} className="overflow-hidden border-border bg-card">
                  <CardContent className="space-y-4 p-0">
                    <Skeleton className="aspect-[4/3] w-full rounded-none" />
                    <div className="space-y-3 p-4 pt-0">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-border bg-card">
        <div className="space-y-4 p-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </aside>
    </div>
  );
}
