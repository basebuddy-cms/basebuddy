import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <h1 className="text-7xl font-bold text-foreground">404</h1>
      <p className="mt-3 text-lg text-muted-foreground">This page doesn&apos;t exist</p>
      <Button variant="hero-outline" size="sm" asChild className="mt-6">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
