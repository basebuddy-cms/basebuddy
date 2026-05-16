import { createClient as createConnectedSupabaseClient } from "@supabase/supabase-js";

export const createConnectedProjectStorageClient = ({
  apiUrl,
  serviceRoleKey,
}: {
  apiUrl: string;
  serviceRoleKey: string;
}) =>
  createConnectedSupabaseClient(apiUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
