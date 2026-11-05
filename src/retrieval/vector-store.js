import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../config/env.js";
import { supabaseClient } from "../config/db.js";
import { embedding } from "../embeddings/embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export const vectorStore = new SupabaseVectorStore(embedding(), {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});
