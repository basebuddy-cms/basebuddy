import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export const createClient = () =>
  createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
