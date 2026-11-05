import { afterEach, describe, expect, it, vi } from "vitest";
import { sendQuestion } from "../../client/src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("frontend API client", () => {
  it("sends chat request data", async () => {
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
        body: JSON.stringify({ question: "What is RAG?", sessionId: "session-1" }),
      }),
    );
  });
});
