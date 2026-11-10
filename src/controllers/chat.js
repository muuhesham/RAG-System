import express from "express";
import { llm } from "../llm/llm.js";
import { responsePrompt } from "../prompts/responsePrompt.js";
import { vectorStore } from "../retrieval/vector-store.js";
import { transformationPrompt } from "../prompts/transformationPrompt.js";
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
    const searchQuery = rewriteResponse.correctedQuestion;
    console.log("Search query:", searchQuery);

    const relevantDocs = await vectorStore.similaritySearch(searchQuery, 4, {
      owner_user_id: req.user.id,
    });
    const context = relevantDocs
      .map((doc) => doc.pageContent.trim())
      .join("\n\n")
      .slice(0, 3000);
    const messages = await responsePrompt.invoke({
      context,
      chatHistory,
      question,
    });
    const response = await structuredAnswerLlm.invoke(messages);
    const answer = response.answer;
    const uniqueDocs = [
      ...new Set(relevantDocs.map((doc) => doc.metadata.source)),
    ];

    await saveChatMessages(req.user.id, sessionId, question, answer, {
      confidence: response.confidence,
      keyPoints: response.keyPoints,
      suggestedQuestions: response.suggestedQuestions,
      sources: response.answeredFromContext ? uniqueDocs : [],
    });

    res.json({
      answer,
      confidence: response.confidence,
      keyPoints: response.keyPoints,
      suggestedQuestions: response.suggestedQuestions,
      sources: response.answeredFromContext ? uniqueDocs : [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong while answering the question",
    });
  }
});

export default router;
