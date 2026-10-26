import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AI_API_KEY } from "./env.js";

export const llm = new ChatGoogleGenerativeAI({
  apiKey: AI_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0,
});
