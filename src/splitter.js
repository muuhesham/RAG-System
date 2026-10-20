import { SUPABASE_URL, SUPABASE_SECRET_KEY } from "./env.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { supabaseClient } from "./db.js";
import { embedding } from "./embedding.js";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const documentsPath = path.join(__dirname, "documents");

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

// create the text splitter
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 150,
  chunkOverlap: 30,
});

export async function ingestDocument(fileName) {
  const filePath = path.join(documentsPath, fileName);
  const document = fs.readFileSync(filePath, "utf-8");
  const docs = await textSplitter.createDocuments(
    [document],
    [{ source: fileName }],
  );

  console.log(`Number of chunks for ${fileName}:`, docs.length);

  await SupabaseVectorStore.fromDocuments(docs, embeddings, {
    client: supabase,
    tableName: "documents",
    queryName: "match_documents",
  });

  return docs.length;
}

export async function ingestDocuments() {
  const documentFiles = fs
    .readdirSync(documentsPath)
    .filter((fileName) => /\.(txt|md)$/i.test(fileName));

  if (documentFiles.length === 0) {
    throw new Error(`No .txt or .md documents found in ${documentsPath}`);
  }

  let totalChunks = 0;
  for (const fileName of documentFiles) {
    totalChunks += await ingestDocument(fileName);
  }

  console.log(`Documents stored successfully. Total chunks: ${totalChunks}`);
}

