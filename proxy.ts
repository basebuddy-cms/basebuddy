import type { NextRequest } from "next/server";

import { middleware } from "./src/middleware";

export async function proxy(request: NextRequest) {
  return middleware(request);
}

export { config } from "./src/middleware";
