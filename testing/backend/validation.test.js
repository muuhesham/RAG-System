import { describe, expect, it } from "vitest";
import {
  answerSchema,
  chatRequestSchema,
  correctedQuestionSchema,
  documentNameParamsSchema,
  sessionIdParamsSchema,
  uploadedDocumentsSchema,
} from "../../src/utils/validation.js";

describe("backend request validation", () => {
  it("accepts and trims a valid chat request", () => {
    const result = chatRequestSchema.parse({
      question: "  What is RAG?  ",
      sessionId: "  session-1  ",
    });

    expect(result).toEqual({
      question: "What is RAG?",
      sessionId: "session-1",
    });
  });

  it("rejects empty chat values and oversized session ids", () => {
    expect(
      chatRequestSchema.safeParse({ question: " ", sessionId: "session-1" })
        .success,
    ).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        question: "Question",
        sessionId: "a".repeat(129),
      }).success,
    ).toBe(false);
  });

  it("accepts valid session and document params", () => {
    expect(sessionIdParamsSchema.parse({ sessionId: "session-1" })).toEqual({
      sessionId: "session-1",
    });
    expect(documentNameParamsSchema.parse({ fileName: "notes.pdf" })).toEqual({
      fileName: "notes.pdf",
    });
  });

  it("rejects document params containing paths", () => {
    expect(
      documentNameParamsSchema.safeParse({ fileName: "../notes.pdf" }).success,
    ).toBe(false);
    expect(
      documentNameParamsSchema.safeParse({ fileName: "folder\\notes.pdf" })
        .success,
    ).toBe(false);
  });

  it("validates supported document uploads and size limits", () => {
    expect(
      uploadedDocumentsSchema.safeParse([
        { originalname: "guide.pdf", size: 1024 },
      ]).success,
    ).toBe(true);
    expect(
      uploadedDocumentsSchema.safeParse([
        { originalname: "image.png", size: 1024 },
      ]).success,
    ).toBe(false);
    expect(
      uploadedDocumentsSchema.safeParse([
        { originalname: "guide.pdf", size: 5 * 1024 * 1024 + 1 },
      ]).success,
    ).toBe(false);
  });
});

describe("backend structured LLM validation", () => {
  it("validates a corrected question", () => {
    expect(
      correctedQuestionSchema.parse({
        correctedQuestion: "What is retrieval augmented generation?",
      }),
    ).toEqual({
      correctedQuestion: "What is retrieval augmented generation?",
    });
  });

  it("validates the answer fields returned to the frontend", () => {
    const result = answerSchema.parse({
      answeredFromContext: true,
      answer: "RAG combines retrieval with generation.",
      confidence: "high",
      keyPoints: ["Retrieval provides context.", "Generation creates the answer."],
      suggestedQuestions: ["How does retrieval work?"],
    });

    expect(result.answer).toContain("RAG");
    expect(result.confidence).toBe("high");
  });

  it("rejects unknown confidence levels and empty answers", () => {
    expect(
      answerSchema.safeParse({
        answeredFromContext: true,
        answer: "",
        confidence: "certain",
        keyPoints: [],
        suggestedQuestions: [],
      }).success,
    ).toBe(false);
  });
});
