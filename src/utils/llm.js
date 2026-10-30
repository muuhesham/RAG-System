import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { InMemoryCache } from "@langchain/core/caches";
import { AI_API_KEY } from "./env.js";

const modelCache = new InMemoryCache();

export const llm = new ChatGoogleGenerativeAI({
  apiKey: AI_API_KEY,
  model: "gemini-3.5-flash-lite",
  temperature: 0,
  maxOutputTokens: 700,
  topP: 0.8,
  cache: modelCache,
});
