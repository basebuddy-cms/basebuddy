"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const createDirectUploadSupabaseClient = (apiUrl: string, publishableKey: string) =>
  createSupabaseClient(apiUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
