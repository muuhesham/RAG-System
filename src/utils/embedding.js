import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { AI_API_KEY } from "./env.js";

export const embedding = () => {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: AI_API_KEY,
    model: "gemini-embedding-001",
  });
};
