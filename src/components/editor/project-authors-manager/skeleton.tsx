"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ProjectAuthorsManagerSkeleton() {
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="mb-8 space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[40px_minmax(0,1.1fr)_120px_220px_104px] gap-4 border-b border-border pb-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`authors-skeleton-${index}`}
                className="grid grid-cols-[40px_minmax(0,1.1fr)_120px_220px_104px] gap-4 py-3"
              >
                <Skeleton className="h-4 w-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-40 rounded-md" />
                <Skeleton className="ml-auto h-8 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-border bg-card">
        <div className="space-y-4 p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </aside>
    </div>
  );
}
