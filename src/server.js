import express from "express";
import { PORT, SUPABASE_URL, SUPABASE_SECRET_KEY } from "./env.js";
import { chatModel } from "./utils/ai-model.js";
import { supabaseClient } from "./db.js";
import { embedding } from "./utils/embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { prompt } from "./utils/prompt.js";
import { documentsPath, ingestDocument } from "./splitter.js";
import { upload } from "./utils/multer.js";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
app.use(express.json());

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

app.post("/documents", upload.array("documents", 20), async (req, res) => {
  const savedFileNames = [];
  const indexedFileNames = [];
  const uploadedDocuments = [];

  try {
    if (!req.files?.length) {
      return res.status(400).json({
        message: "Please upload at least one file using the 'documents' field.",
      });
    }

    await fs.mkdir(documentsPath, { recursive: true });
    const existingDocuments = (await fs.readdir(documentsPath)).map(
      (fileName) => fileName.toLowerCase(),
    );

    for (const file of req.files) {
      const fileName = path.basename(file.originalname).toLowerCase();

      if (existingDocuments.includes(fileName)) {
        return res.status(409).json({
          message: `Document already exists: ${fileName}`,
        });
      }

      await fs.writeFile(path.join(documentsPath, fileName), file.buffer);
      savedFileNames.push(fileName);
      existingDocuments.push(fileName);
      const chunks = await ingestDocument(fileName);
      indexedFileNames.push(fileName);
      uploadedDocuments.push({ fileName, chunks });
    }

    res.status(201).json({
      message: "Documents uploaded successfully!",
      documents: uploadedDocuments,
    });
  } catch (err) {
    console.error(err);

    for (const fileName of savedFileNames) {
      await fs.rm(path.join(documentsPath, fileName), { force: true });
    }

    for (const fileName of indexedFileNames) {
      await supabase
        .from("documents")
        .delete()
        .contains("metadata", { source: fileName });
    }

    res.status(500).json({ error: "Could not upload the document." });
  }
});

app.get("/documents", async (_req, res) => {
  try {
    const documents = await fs.readdir(documentsPath);

    res.json({
      count: documents.length,
      documents,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ count: 0, documents: [] });
    }

    console.error(err);
    res.status(500).json({ error: "Could not list the documents." });
  }
});

app.delete("/documents/:fileName", async (req, res) => {
  try {
    const name = req.params.fileName.toLocaleLowerCase();
    if (!name || typeof name !== "string") {
      throw new Error("file name must be string.");
    }
    const fileName = path.basename(name);
    const filePath = path.join(documentsPath, fileName);
    await fs.unlink(filePath);

    const { error } = await supabase
      .from("documents")
      .delete()
      .contains("metadata", { source: fileName });

    if (error) {
      throw error;
    }

    res.json({ message: "Document deleted successfully!", fileName });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ message: "Document not found." });
    }

    console.error(err);
    res.status(500).json({ error: "Could not delete the document." });
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
