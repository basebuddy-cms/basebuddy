import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Loader2>) {
  return <Loader2 aria-hidden="true" className={cn("animate-spin", className)} {...props} />;
}

export { Spinner };
