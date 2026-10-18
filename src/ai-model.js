import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AI_API_KEY } from "./env.js";

export const chatModel = new ChatGoogleGenerativeAI({
  apiKey: AI_API_KEY,
  model: "gemini-3.8-flash",
  temperature: 0,
});
