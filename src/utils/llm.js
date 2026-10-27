import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { InMemoryCache } from "@langchain/core/caches";
import { AI_API_KEY } from "./env.js";

const modelCache = new InMemoryCache();

export const llm = new ChatGoogleGenerativeAI({
  apiKey: AI_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0,
  cache: modelCache,
});
