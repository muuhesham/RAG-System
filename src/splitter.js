import { SUPABASE_URL, SUPABASE_SECRET_KEY } from "./env.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { supabaseClient } from "./db.js";
import { embedding } from "./embedding.js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const documentPath = path.join(__dirname, "document.txt");
const document = fs.readFileSync(documentPath, "utf-8");

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

// create the text splitter
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 150,
  chunkOverlap: 30,
});

const docs = await textSplitter.createDocuments(
  [document],
  [{ source: "document.txt" }],
);

console.log("Number of chunks:", docs.length);
console.log(docs.map((doc) => doc.pageContent));

// store the embeddings in supabase
await SupabaseVectorStore.fromDocuments(docs, embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

console.log("Documents stored Successfully!");
