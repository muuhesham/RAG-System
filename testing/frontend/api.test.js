import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearConversation,
  deleteDocument,
  listDocuments,
  sendQuestion,
  uploadDocuments,
} from "../../client/src/api.js";

describe("frontend API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a chat question and session id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "RAG answer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await sendQuestion("What is RAG?", "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "What is RAG?",
          sessionId: "session-1",
        }),
      }),
    );
  });

  it("lists and clears documents and conversation history", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ count: 0, documents: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await listDocuments();
    await clearConversation("session 1");
    await deleteDocument("notes.pdf");

    expect(fetchMock.mock.calls[1][0]).toBe("/chat/history/session%201");
    expect(fetchMock.mock.calls[2][0]).toBe("/documents/notes.pdf");
  });

  it("uploads files as multipart form data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Uploaded" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await uploadDocuments([new File(["hello"], "notes.txt")]);

    const options = fetchMock.mock.calls[0][1];
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("documents").name).toBe("notes.txt");
  });

  it("turns a backend error response into a useful message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Could not upload the document." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(uploadDocuments([])).rejects.toThrow(
      "Could not upload the document.",
    );
  });
});
