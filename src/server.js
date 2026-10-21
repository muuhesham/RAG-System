import express from "express";
import {
  PORT,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
} from "./env.js";
import { chatModel } from "./ai-model.js";
import {supabaseClient} from "./db.js";
import {embedding} from "./embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { prompt } from "./prompt.js";
import { documentsPath, ingestDocument } from "./splitter.js";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedExtensions = [".txt", ".md"];
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowedExtensions.includes(extension));
  },
});

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

app.post("/documents", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a .txt or .md file using the 'document' field.",
      });
    }

    const fileName = path.basename(req.file.originalname);
    await fs.mkdir(documentsPath, { recursive: true });
    await fs.writeFile(path.join(documentsPath, fileName), req.file.buffer);

    const chunks = await ingestDocument(fileName);

    res.status(201).json({
      message: "Document uploaded and indexed successfully.",
      fileName,
      chunks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not upload and index the document." });
  }
});


app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "please provide a valid question!",
      });
    }
    const relevantDocs = await vectorStore.similaritySearch(question, 4);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    const messages = await prompt.invoke({ context, question });
    const response = await chatModel.invoke(messages);

    res.json({
      answer: response.content,
      sources: relevantDocs.map((doc) => doc.metadata),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong while answering the question",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
