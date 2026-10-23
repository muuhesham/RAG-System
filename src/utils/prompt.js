import { ChatPromptTemplate } from "@langchain/core/prompts";

export const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Answer the user's question using the context below.
If the context does not contain the answer, say you don't
have enough information in the provided documents.

Context:
{context}`,
  ],
  ["human", "{question}"],
]);
