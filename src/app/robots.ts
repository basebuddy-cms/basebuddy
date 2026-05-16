import type { MetadataRoute } from "next";

import { getSiteRobotsRules } from "@/lib/site-indexing";

export default function robots(): MetadataRoute.Robots {
  return getSiteRobotsRules();
}
