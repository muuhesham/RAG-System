import express from "express";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../utils/env.js";
import { llm } from "../utils/llm.js";
import { supabaseClient } from "../utils/db.js";
import { embedding } from "../utils/embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { resposnePrompt } from "../utils/prompts/responsePrompt.js";
import { transformationPrompt } from "../utils/prompts/transformationPrompt.js";
import { createRateLimiter } from "../utils/rate-limit.js";
import {
  deleteSessionHistory,
  getSessionHistory,
} from "../utils/converstion-memory.js";

const router = express.Router();
const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

router.delete(
  "/history/:sessionId",
  createRateLimiter(5),
  (req, res) => {
    const { sessionId } = req.params;
    if (
      !sessionId ||
      sessionId.trim().length === 0 ||
      sessionId.trim().length > 128
    ) {
      return res.status(400).json({
        message: "Please provide a valid sessionId.",
      });
    }

    if (!deleteSessionHistory(sessionId.trim())) {
      return res.status(404).json({
        message: "Conversation history not found.",
      });
    }

    res.json({ message: "Conversation history deleted successfully." });
  },
);

router.post("/", createRateLimiter(5), async (req, res) => {
  try {
    const { question, sessionId } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "please provide a valid question!",
      });
    }
    if (
      typeof sessionId !== "string" ||
      sessionId.trim().length === 0 ||
      sessionId.trim().length > 128
    ) {
      return res.status(400).json({
        message: "Please provide a valid sessionId.",
      });
    }

    const historyStore = getSessionHistory(sessionId.trim());
    const allMessages = await historyStore.getMessages();
    const chatHistory = allMessages.slice(-6);
    const rewriteMessage = await transformationPrompt.invoke({
      chatHistory,
      question,
    });
    const rewriteResponse = await llm.invoke(rewriteMessage);
    const transfromationQuestion = rewriteResponse.content.toString().trim();
    const relevantDocs = await vectorStore.similaritySearch(
      transfromationQuestion,
      4,
    );
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    const messages = await resposnePrompt.invoke({
      context,
      chatHistory,
      question: transfromationQuestion,
    });
    const response = await llm.invoke(messages);
    await historyStore.addUserMessage(transfromationQuestion);
    await historyStore.addAIMessage(response.content.toString());

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

export default router;
