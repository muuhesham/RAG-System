import { z } from 'zod';

export const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(5000),
  sessionId: z.string().trim().min(1).max(128),
});

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
});

export const documentNameParamsSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((fileName) => ![".", ".."].includes(fileName))
    .refine((fileName) => !/[\/\\]/.test(fileName)),
});

export const uploadedDocumentSchema = z.object({
  originalname: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/\.(txt|md|pdf)$/i),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});

export const uploadedDocumentsSchema = z
  .array(uploadedDocumentSchema)
  .min(1)
  .max(20);

export const correctedQuestionSchema = z.object({
  correctedQuestion: z
    .string()
    .trim()
    .min(1)
    .describe("The corrected and clarified user question."),
});

export const answerSchema = z.object({
  answeredFromContext: z
    .boolean()
    .describe("Whether the provided context contains enough information to answer the user's question."),
  answer: z
    .string()
    .trim()
    .min(1)
    .describe("The final answer to the user's question."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("How confidently the answer is supported by the provided context."),
  keyPoints: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(3)
    .describe("A few concise points that summarize the answer."),
  suggestedQuestions: z
    .array(z.string().trim().min(1))
    .min(0)
    .max(3)
    .describe("Useful follow-up questions related to the answer."),
});
