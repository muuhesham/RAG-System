import express from "express";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../config/env.js";
import { supabaseClient } from "../config/db.js";
import { documentsPath, ingestDocument } from "../ingestion/splitter.js";
import { upload } from "../config/multer.js";
import { createRateLimiter } from "../middlewares/rate-limit.js";
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

      const ownerPath = path.join(documentsPath, req.user.id);
      await fs.mkdir(ownerPath, { recursive: true });
      const existingDocuments = (await fs.readdir(ownerPath)).map(
        (fileName) => fileName.toLowerCase(),
      );

      for (const file of req.files) {
        const fileName = path.basename(file.originalname).toLowerCase();

        if (existingDocuments.includes(fileName)) {
          return res.status(409).json({
            message: `Document already exists: ${fileName}`,
          });
        }

        await fs.writeFile(path.join(ownerPath, fileName), file.buffer);
        savedFileNames.push(fileName);
        existingDocuments.push(fileName);
        const chunks = await ingestDocument(fileName, req.user.id);
        indexedFileNames.push(fileName);
        uploadedDocuments.push({ fileName, chunks });
        const { error: documentError } = await supabase
          .from("user_documents")
          .insert({
            user_id: req.user.id,
            file_name: fileName,
            storage_path: path.join(req.user.id, fileName),
            chunk_count: chunks,
          });
        if (documentError) throw documentError;
      }

      res.status(201).json({
        message: "Documents uploaded successfully!",
        documents: uploadedDocuments,
      });
    } catch (err) {
      console.error(err);

      for (const fileName of savedFileNames) {
        await fs.rm(path.join(documentsPath, req.user.id, fileName), { force: true });
      }

      for (const fileName of indexedFileNames) {
        await supabase
          .from("documents")
          .delete()
          .contains("metadata", { source: fileName, owner_user_id: req.user.id });
      }

      res.status(500).json({ error: "Could not upload the document." });
    }
  },
);

router.get("/", createRateLimiter(20), async (req, res) => {
  try {
    const ownerPath = path.join(documentsPath, req.user.id);
    const documents = await fs.readdir(ownerPath);

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
    const filePath = path.join(documentsPath, req.user.id, fileName);
    await fs.unlink(filePath);

    const { error } = await supabase
      .from("documents")
      .delete()
      .contains("metadata", { source: fileName, owner_user_id: req.user.id });

    if (error) {
      throw error;
    }
    const { error: documentError } = await supabase
      .from("user_documents")
      .delete()
      .eq("user_id", req.user.id)
      .eq("file_name", fileName);
    if (documentError) throw documentError;

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
