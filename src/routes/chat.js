import express from "express";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../utils/env.js";
import { llm } from "../utils/llm.js";
import { supabaseClient } from "../utils/db.js";
import { embedding } from "../utils/embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { responsePrompt } from "../utils/prompts/responsePrompt.js";
import { transformationPrompt } from "../utils/prompts/transformationPrompt.js";
import {
  answerSchema,
  chatRequestSchema,
  correctedQuestionSchema,
  sessionIdParamsSchema,
} from "../utils/validation.js";
import { createRateLimiter } from "../utils/rate-limit.js";
import {
  deleteSessionHistory,
  getSessionHistory,
} from "../utils/conversation-memory.js";

const router = express.Router();
const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();
const structuredTransformationLlm =
  llm.withStructuredOutput(correctedQuestionSchema);
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
    const paramsResult = sessionIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        message: "Please provide a valid sessionId.",
      });
    }

    const { sessionId } = paramsResult.data;
    if (!deleteSessionHistory(sessionId)) {
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

    const bodyResult = chatRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        message: "Please provide a valid question and sessionId.",
      });
    }

    const { question, sessionId } = bodyResult.data;
    const historyStore = getSessionHistory(sessionId);
    const allMessages = await historyStore.getMessages();
    const chatHistory = allMessages.slice(-6);
    const rewriteMessage = await transformationPrompt.invoke({
      chatHistory,
      question,
    });
    const rewriteResponse =
      await structuredTransformationLlm.invoke(rewriteMessage);
    const transformationQuestion = rewriteResponse.correctedQuestion;
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
    const response = await structuredAnswerLlm.invoke(messages);
    const answer = response.answer;
    const uniqueDocs = [
      ...new Set(relevantDocs.map((doc) => doc.metadata.source)),
    ];

    res.json({
      answer,
      confidence: response.confidence,
      keyPoints: response.keyPoints,
      suggestedQuestions: response.suggestedQuestions,
      sources: response.answeredFromContext ? uniqueDocs : [],
    });

    await Promise.all([
      historyStore.addUserMessage(question),
      historyStore.addAIMessage(answer),
    ]);
    const updatedMessages = await historyStore.getMessages();
    if (updatedMessages.length > 10) {
      await historyStore.clear();
      await historyStore.addMessages(updatedMessages.slice(-6));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong while answering the question",
    });
  }
});

export default router;
