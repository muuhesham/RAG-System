import express from "express";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../utils/env.js";
import { llm } from "../utils/llm.js";
import { supabaseClient } from "../utils/db.js";
import { embedding } from "../utils/embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { responsePrompt } from "../utils/prompts/responsePrompt.js";
import { transformationPrompt } from "../utils/prompts/transformationPrompt.js";
import { createRateLimiter } from "../utils/rate-limit.js";
import {
  deleteSessionHistory,
  getSessionHistory,
} from "../utils/conversation-memory.js";

const router = express.Router();
const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();
const structuredTransformationLlm = llm.withStructuredOutput(correctedQuestionSchema);
const structuredAnswerLlm = llm.withStructuredOutput(answerSchema);

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
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Please provide a JSON object with question and sessionId.",
      });
    }

    const { question, sessionId } = req.body;
    if (typeof question !== "string" || question.trim().length === 0) {
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
<<<<<<< Updated upstream
    const rewriteResponse = await llm.invoke(rewriteMessage);
    const transformationQuestion = rewriteResponse.content.toString().trim();
=======
    const rewriteResponse = await structuredTransformationLlm.invoke(rewriteMessage);
    const transformationQuestion = rewriteResponse.correctedQuestion;
>>>>>>> Stashed changes
    const relevantDocs = await vectorStore.similaritySearch(
      transformationQuestion,
      3,
    );
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    const messages = await responsePrompt.invoke({
      context,
      chatHistory,
      question: transformationQuestion,
    });
<<<<<<< Updated upstream
    const response = await llm.invoke(messages);
    await historyStore.addUserMessage(question);
    await historyStore.addAIMessage(response.content.toString());
    const updatedMessages = await historyStore.getMessages();
    if (updatedMessages.length > 10) {
      await historyStore.clear();
      await historyStore.addMessages(updatedMessages.slice(-10));
    }

    res.json({
      answer: response.content,
      sources: relevantDocs.map((doc) => doc.metadata),
    });
=======
    const response = await structuredAnswerLlm.invoke(messages);
    const answer = response.answer;
    const uniqueDocs = [
      ...new Set(relevantDocs.map((doc) => doc.metadata.source)),
    ];

    const responsePayload = {
      answer,
      confidence: response.confidence,
      keyPoints: response.keyPoints,
      suggestedQuestions: response.suggestedQuestions,
      sources: response.answeredFromContext ? uniqueDocs : [],
    };

    res.json(responsePayload);

    await Promise.all([
      historyStore.addUserMessage(question),
      historyStore.addAIMessage(answer),
    ]);
    const updatedMessages = await historyStore.getMessages();
    if (updatedMessages.length > 10) {
      await historyStore.clear();
      await historyStore.addMessages(updatedMessages.slice(-6));
    }


>>>>>>> Stashed changes
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong while answering the question",
    });
  }
});

export default router;
