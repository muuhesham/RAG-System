import { createClient } from "@supabase/supabase-js";

export const supabaseClient = (url, secretKey) =>
  createClient(url, secretKey);
