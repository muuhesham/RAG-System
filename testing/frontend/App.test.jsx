import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../client/src/App.jsx";
import { listDocuments, sendQuestion } from "../../client/src/api.js";

vi.mock("../../client/src/api.js", () => ({
  clearConversation: vi.fn().mockResolvedValue({ message: "Cleared." }),
  deleteDocument: vi.fn().mockResolvedValue({ message: "Deleted." }),
  listDocuments: vi.fn(),
  sendQuestion: vi.fn(),
  uploadDocuments: vi.fn().mockResolvedValue({ message: "Uploaded." }),
}));

describe("App UI", () => {
  beforeEach(() => {
    localStorage.clear();
    listDocuments.mockResolvedValue({ documents: [] });
    vi.stubGlobal("crypto", { randomUUID: () => "test-session-id" });
  });

  afterEach(cleanup);

  it("renders the assistant and question input", async () => {
    render(<App />);
    expect(await screen.findByRole("link", { name: /rag assistant home/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask about your documents/i)).toBeInTheDocument();
  });

  it("switches between light and dark themes", async () => {
    render(<App />);
    const themeButton = await screen.findByRole("button", { name: /enable dark mode/i });
    fireEvent.click(themeButton);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("displays and submits a structured answer", async () => {
    sendQuestion.mockResolvedValue({
      answer: "A retrieved answer.",
      confidence: "high",
      keyPoints: ["Important point."],
      suggestedQuestions: [],
      sources: [],
    });
    render(<App />);
    const input = await screen.findByPlaceholderText(/ask about your documents/i);
    fireEvent.change(input, { target: { value: "What is RAG?" } });
    fireEvent.click(screen.getByRole("button", { name: /send question/i }));
    expect(await screen.findByText("A retrieved answer.")).toBeInTheDocument();
    expect(sendQuestion).toHaveBeenCalledWith("What is RAG?", "test-session-id");
  });
});
