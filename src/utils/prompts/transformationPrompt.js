import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

export const transformationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a query rewriter for a RAG system.
Fix any grammar, spelling, or punctuation errors in the user's question, and make it clear and concise for vector search.
CRITICAL: Keep the rewritten question in the EXACT same language the user intended.
Do NOT answer the question. Return ONLY the corrected question.`,
  ],
  new MessagesPlaceholder("chatHistory"),
  ["human", "{question}"],
]);
