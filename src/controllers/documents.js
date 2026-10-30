import express from "express";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../utils/env.js";
import { supabaseClient } from "../utils/db.js";
import { documentsPath, ingestDocument } from "../splitter.js";
import { upload } from "../utils/multer.js";
import { createRateLimiter } from "../utils/rate-limit.js";
import {
  documentNameParamsSchema,
  uploadedDocumentsSchema,
} from "../utils/validation.js";
import fs from "node:fs/promises";
import path from "node:path";

const router = express.Router();
const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

router.post(
  "/",
  createRateLimiter(10),
  upload.array("documents", 20),
  async (req, res) => {
    const savedFileNames = [];
    const indexedFileNames = [];
    const uploadedDocuments = [];

    try {
      if (!req.files?.length) {
        return res.status(400).json({
          message: "Please upload at least one file using the 'documents' field.",
        });
      }
      const filesResult = uploadedDocumentsSchema.safeParse(req.files);
      if (!filesResult.success) {
        return res.status(400).json({
          message: "Please upload valid document files.",
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
  },
);

router.get("/", createRateLimiter(20), async (_req, res) => {
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

router.delete("/:fileName", createRateLimiter(10), async (req, res) => {
  try {
    const paramsResult = documentNameParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({ message: "Please provide a valid file name." });
    }
    const name = paramsResult.data.fileName.toLocaleLowerCase();
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

export default router;
