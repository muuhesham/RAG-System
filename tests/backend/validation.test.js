import { describe, expect, it } from "vitest";
import {
  answerSchema,
  chatRequestSchema,
  correctedQuestionSchema,
  documentNameParamsSchema,
} from "../../src/utils/validation.js";

describe("request and structured output validation", () => {
  it("accepts valid chat input", () => {
    expect(
      chatRequestSchema.parse({
        question: "What is RAG?",
        sessionId: "session-1",
      }),
    ).toEqual({
      question: "What is RAG?",
      sessionId: "session-1",
    });
  });

  it("rejects invalid chat and document names", () => {
    expect(chatRequestSchema.safeParse({ question: "", sessionId: "" }).success).toBe(false);
    expect(documentNameParamsSchema.safeParse({ fileName: "../notes.pdf" }).success).toBe(false);
  });

  it("validates corrected questions and answers", () => {
    expect(correctedQuestionSchema.parse({ correctedQuestion: "What is RAG?" }).correctedQuestion).toBe("What is RAG?");
    expect(answerSchema.safeParse({
      answeredFromContext: true,
      answer: "RAG combines retrieval and generation.",
      confidence: "high",
      keyPoints: ["Uses retrieved context."],
      suggestedQuestions: [],
    }).success).toBe(true);
  });
});
