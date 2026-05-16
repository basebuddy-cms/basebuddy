import { createAdminClient as createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const createControlPlaneAdminClient = createSupabaseAdminClient;

export const createControlPlaneServerClient = createSupabaseServerClient;
