import express from "express";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../utils/env.js";
import { llm } from "../utils/llm.js";
import { supabaseClient } from "../utils/db.js";
import { embedding } from "../utils/embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { resposnePrompt } from "../utils/prompts/responsePrompt.js";
import { transformationPrompt } from "../utils/prompts/transformationPrompt.js";
import { createRateLimiter } from "../utils/rate-limit.js";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

const router = express.Router();
const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

router.post("/", createRateLimiter(5), async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "please provide a valid question!",
      });
    }

    const historyStore = new InMemoryChatMessageHistory();
    const allMessages = await historyStore.getMessages();
    const chatHistory = allMessages.slice(-5);
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
