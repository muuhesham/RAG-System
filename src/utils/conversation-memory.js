import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./env.js";
import { supabaseClient } from "./db.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function getSessionHistory(userId, sessionId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, metadata, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).slice(-10).map((message) =>
    message.role === "assistant"
      ? new AIMessage({ content: message.content })
      : new HumanMessage({ content: message.content }),
  );
}

export async function saveChatMessages(userId, sessionId, question, answer, metadata = {}) {
  const { error } = await supabase.from("chat_messages").insert([
    { user_id: userId, session_id: sessionId, role: "user", content: question },
    {
      user_id: userId,
      session_id: sessionId,
      role: "assistant",
      content: answer,
      metadata,
    },
  ]);
  if (error) throw error;
}

export async function listSessionMessages(userId, sessionId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, metadata, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function deleteSessionHistory(userId, sessionId) {
  const { error, count } = await supabase
    .from("chat_messages")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("session_id", sessionId);

  if (error) throw error;
  return (count ?? 0) > 0;
}