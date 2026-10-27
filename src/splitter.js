import { SUPABASE_URL, SUPABASE_SECRET_KEY } from "./utils/env.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { supabaseClient } from "./utils/db.js";
import { embedding } from "./utils/embedding.js";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const documentsPath = path.join(__dirname, "documents");

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 150,
  chunkOverlap: 30,
});

export async function ingestDocument(fileName) {
  const filePath = path.join(documentsPath, fileName);
  const extension = path.extname(fileName).toLowerCase();
  let docs;

  if (extension === ".pdf") {
    const loader = new PDFLoader(filePath);
    const pdfDocuments = await loader.load();

    docs = await textSplitter.splitDocuments(
      pdfDocuments.map((document) => ({
        ...document,
        metadata: {
          ...document.metadata,
          source: fileName,
        },
      })),
    );
  } else if (extension === ".txt" || extension === ".md") {
    const document = await fs.readFile(filePath, "utf-8");
    docs = await textSplitter.createDocuments(
      [document],
      [{ source: fileName }],
    );
  } else {
    throw new Error(`Unsupported document type: ${extension}`);
  }

  console.log(`Number of chunks for ${fileName}:`, docs.length);

  await SupabaseVectorStore.fromDocuments(docs, embeddings, {
    client: supabase,
    tableName: "documents",
    queryName: "match_documents",
  });

  return docs.length;
}
