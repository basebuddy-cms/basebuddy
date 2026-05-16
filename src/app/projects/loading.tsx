import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </nav>
      <div className="container mx-auto px-6 py-10">
        <div className="mb-8">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[168px] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
