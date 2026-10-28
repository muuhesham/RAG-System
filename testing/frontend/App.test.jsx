import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../client/src/App.jsx";
import {
  clearConversation,
  deleteDocument,
  listDocuments,
  sendQuestion,
  uploadDocuments,
} from "../../client/src/api.js";

vi.mock("../../client/src/api.js", () => ({
  clearConversation: vi.fn(),
  deleteDocument: vi.fn(),
  listDocuments: vi.fn(),
  sendQuestion: vi.fn(),
  uploadDocuments: vi.fn(),
}));

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "test-session-id" });
    listDocuments.mockResolvedValue({ documents: [] });
    clearConversation.mockResolvedValue({ message: "Conversation cleared." });
    deleteDocument.mockResolvedValue({ message: "Document deleted." });
    uploadDocuments.mockResolvedValue({ message: "Documents uploaded." });
  });

  it("renders the assistant and empty chat state", async () => {
    render(<App />);

    expect(
      await screen.findByRole("link", { name: /rag assistant home/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/start with a question/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/ask about your documents/i),
    ).toBeInTheDocument();
  });

  it("submits a question and displays structured answer data", async () => {
    sendQuestion.mockResolvedValue({
      answer: "Retrieval augmented generation combines search with generation.",
      confidence: "high",
      keyPoints: ["Retrieval supplies context.", "Generation creates the answer."],
      suggestedQuestions: ["How does retrieval work?"],
      sources: [{ source: "guide.pdf" }],
    });

    render(<App />);
    const input = await screen.findByPlaceholderText(/ask about your documents/i);
    fireEvent.change(input, { target: { value: "What is RAG?" } });
    fireEvent.click(screen.getByRole("button", { name: /send question/i }));

    expect(
      await screen.findByText(/Retrieval augmented generation/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Confidence: high")).toBeInTheDocument();
    expect(screen.getByText("Retrieval supplies context.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How does retrieval work?" })).toBeInTheDocument();
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    expect(sendQuestion).toHaveBeenCalledWith("What is RAG?", "test-session-id");
  });

  it("fills the question input when a suggested question is clicked", async () => {
    sendQuestion.mockResolvedValue({
      answer: "An answer.",
      confidence: "medium",
      keyPoints: ["A useful point."],
      suggestedQuestions: ["Explain this further."],
      sources: [],
    });

    render(<App />);
    const input = await screen.findByPlaceholderText(/ask about your documents/i);
    fireEvent.change(input, { target: { value: "RAG?" } });
    fireEvent.click(screen.getByRole("button", { name: /send question/i }));

    fireEvent.click(await screen.findByRole("button", { name: "Explain this further." }));
    expect(input).toHaveValue("Explain this further.");
  });

  it("shows backend errors returned by a failed question", async () => {
    sendQuestion.mockRejectedValue(new Error("Could not answer the question."));

    render(<App />);
    const input = await screen.findByPlaceholderText(/ask about your documents/i);
    fireEvent.change(input, { target: { value: "Unknown topic" } });
    fireEvent.click(screen.getByRole("button", { name: /send question/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not answer the question.",
      );
    });
    expect(input).toHaveValue("Unknown topic");
  });
});
