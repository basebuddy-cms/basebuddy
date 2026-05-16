import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </nav>
      <div className="container mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-8 space-y-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
