import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const authConfigured = Boolean(url && key);
export const supabaseAuth = authConfigured ? createClient(url, key) : null;

export async function getAuthSession() {
  if (!supabaseAuth) return null;
  const { data } = await supabaseAuth.auth.getSession();
  if (data.session?.expires_at && data.session.expires_at * 1000 <= Date.now()) {
    await supabaseAuth.auth.signOut();
    return null;
  }
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  const { data, error } = await supabaseAuth.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabaseAuth.auth.signOut();
  if (error) throw error;
}
