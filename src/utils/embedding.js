import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { AI_API_KEY } from "./env.js";

export const embedding = () => {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: AI_API_KEY,
    model: "gemini-embedding-001",
  });
};

// import { OllamaEmbeddings } from "@langchain/ollama";
// export const embedding = () => {
//   return new OllamaEmbeddings({
//     baseUrl: "http://localhost:11434",
//     model: "nomic-embed-text", // ollama pull nomic-embed-text
//   });
// };
