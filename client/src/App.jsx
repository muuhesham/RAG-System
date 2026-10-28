import { useEffect, useRef, useState } from "react";
import {
  clearConversation,
  deleteDocument,
  listDocuments,
  sendQuestion,
  uploadDocuments,
} from "./api.js";

const SESSION_STORAGE_KEY = "rag-assistant-session-id";
const MESSAGE_LIMIT = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED_EXTENSIONS = /\.(txt|md|pdf)$/i;
const THEME_STORAGE_KEY = "rag-assistant-theme";
const COLLAPSED_MESSAGE_LENGTH = 700;

function getSessionId() {
  const savedId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (savedId) return savedId;

  const sessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

function getMessagesStorageKey(sessionId) {
  return `rag-assistant-messages:${sessionId}`;
}

function loadMessages(sessionId) {
  try {
    const stored = JSON.parse(
      localStorage.getItem(getMessagesStorageKey(sessionId)) ?? "[]",
    );
    return Array.isArray(stored) ? stored.slice(-MESSAGE_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveMessages(sessionId, messages) {
  localStorage.setItem(
    getMessagesStorageKey(sessionId),
    JSON.stringify(messages.slice(-MESSAGE_LIMIT)),
  );
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function Icon({ name, className = "" }) {
  const shared = {
    className,
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "send") {
    return (
      <svg {...shared}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </svg>
    );
  }

  if (name === "upload") {
    return (
      <svg {...shared}>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M20 16.5v3A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-3" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...shared}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 14H6L5 6" />
        <path d="M10 11v5M14 11v5" />
      </svg>
    );
  }

  if (name === "moon") {
    return (
      <svg {...shared}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
      </svg>
    );
  }

  if (name === "sun") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (name === "down") {
    return (
      <svg {...shared}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <path d="M12 3v18" />
      <path d="M3 12h18" />
    </svg>
  );
}

function Message({ message, onSuggestedQuestion }) {
  const isUser = message.role === "user";
  const [expanded, setExpanded] = useState(false);
  const isLong = message.text.length > COLLAPSED_MESSAGE_LENGTH;
  const shownText =
    isLong && !expanded
      ? `${message.text.slice(0, COLLAPSED_MESSAGE_LENGTH).trimEnd()}...`
      : message.text;
  return (
    <article
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`message-avatar ${isUser ? "message-avatar-user" : "message-avatar-ai"}`}
        aria-hidden="true"
      >
        {isUser ? "Y" : "R"}
      </div>
      <div
        className={`message-bubble ${isUser ? "message-bubble-user" : "message-bubble-ai"}`}
      >
        <p dir="auto" className="message-text whitespace-pre-wrap break-words">
          {shownText}
        </p>
        {isLong && (
          <button
            type="button"
            className="see-more-button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "See less" : "See more"}
          </button>
        )}
        {!isUser && message.confidence && (
          <div className="mt-3">
            <span className={`source-chip confidence-${message.confidence}`}>
              Confidence: {message.confidence}
            </span>
          </div>
        )}
        {!isUser && message.keyPoints?.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {message.keyPoints.map((point, index) => (
              <li key={`${point}-${index}`}>{point}</li>
            ))}
          </ul>
        )}
        {!isUser && message.suggestedQuestions?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-200 pt-3">
            {message.suggestedQuestions.map((suggestedQuestion, index) => (
              <button
                type="button"
                className="source-chip cursor-pointer"
                key={`${suggestedQuestion}-${index}`}
                onClick={() => onSuggestedQuestion(suggestedQuestion)}
              >
                {suggestedQuestion}
              </button>
            ))}
          </div>
        )}
        {!isUser && message.sources?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-200 pt-3">
            {message.sources.map((source, index) => {
              const label =
                typeof source?.source === "string"
                  ? source.source
                  : `Source ${index + 1}`;
              return (
                <span className="source-chip" key={`${label}-${index}`}>
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export default function App() {
  const sessionIdRef = useRef(null);
  const messageEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [question, setQuestion] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [documentAction, setDocumentAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) ?? "light",
  );
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const sessionId = getSessionId();
    sessionIdRef.current = sessionId;
    setMessages(loadMessages(sessionId));

    listDocuments()
      .then((result) => setDocuments(result.documents))
      .catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatBusy]);

  function handleChatScroll() {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 180);
  }

  function scrollToLatestMessage() {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function updateMessages(nextMessages) {
    const limitedMessages = nextMessages.slice(-MESSAGE_LIMIT);
    setMessages(limitedMessages);
    if (sessionIdRef.current) {
      saveMessages(sessionIdRef.current, limitedMessages);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || chatBusy) return;

    setQuestion("");
    setError("");
    setNotice("");
    setChatBusy(true);

    try {
      const result = await sendQuestion(
        submittedQuestion,
        sessionIdRef.current,
      );
      updateMessages([
        ...messages,
        { role: "user", text: submittedQuestion },
        {
          role: "assistant",
          text:
            typeof result.answer === "string"
              ? result.answer
              : JSON.stringify(result.answer),
          confidence: result.confidence,
          keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
          suggestedQuestions: Array.isArray(result.suggestedQuestions)
            ? result.suggestedQuestions
            : [],
          sources: Array.isArray(result.sources) ? result.sources : [],
        },
      ]);
    } catch (requestError) {
      setQuestion(submittedQuestion);
      setError(getErrorMessage(requestError));
    } finally {
      setChatBusy(false);
    }
  }

  async function handleClearConversation() {
    if (chatBusy) return;
    setError("");
    setNotice("");

    try {
      await clearConversation(sessionIdRef.current);
    } catch (requestError) {
      if (!getErrorMessage(requestError).includes("not found")) {
        setError(getErrorMessage(requestError));
        return;
      }
    }

    updateMessages([]);
    setNotice("Conversation cleared.");
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await uploadFiles(files);
  }

  async function uploadFiles(files) {
    if (files.length === 0) return;

    if (files.length > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} files at a time.`);
      return;
    }

    const selectedNames = new Set();
    const duplicateName = files.find((file) => {
      const normalizedName = file.name.toLocaleLowerCase();
      if (
        selectedNames.has(normalizedName) ||
        documents.some(
          (document) => document.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return true;
      }

      selectedNames.add(normalizedName);
      return false;
    });
    if (duplicateName) {
      setError(`${duplicateName.name} has already been uploaded or selected.`);
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !ALLOWED_EXTENSIONS.test(file.name) || file.size > MAX_FILE_SIZE,
    );
    if (invalidFile) {
      setError(
        !ALLOWED_EXTENSIONS.test(invalidFile.name)
          ? `${invalidFile.name} is not a supported file. Choose a PDF, TXT, or MD file.`
          : `${invalidFile.name} is larger than the 5 MB limit.`,
      );
      return;
    }

    setError("");
    setNotice("");
    setDocumentsBusy(true);
    try {
      const result = await uploadDocuments(files);
      setNotice(result.message ?? "Documents uploaded successfully.");
      const updatedList = await listDocuments();
      setDocuments(updatedList.documents);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setDocumentsBusy(false);
    }
  }

  async function handleDeleteDocument(fileName) {
    setDocumentAction(fileName);
    setError("");
    setNotice("");
    try {
      const result = await deleteDocument(fileName);
      setDocuments((current) =>
        current.filter((document) => document !== fileName),
      );
      setNotice(result.message ?? "Document deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDocumentAction("");
    }
  }

  return (
    <main
      className={`app-shell min-h-screen ${isDraggingFiles ? "is-file-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggingFiles(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDraggingFiles(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingFiles(false);
        uploadFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      {isDraggingFiles && (
        <div className="file-drop-overlay" role="status">
          <div>
            <Icon name="upload" />
            <span>Drop documents to upload</span>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-8">
        <header className="flex items-center justify-between border-b border-stone-200 py-5">
          <a className="flex items-center gap-3" href="/" aria-label="RAG Assistant home">
            <span className="brand-mark">R</span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">
                RAG Assistant
              </span>
              <span className="block text-xs text-stone-500">
                Ask your documents
              </span>
            </span>
          </a>
          <div className="hidden items-center gap-2 text-xs text-stone-500 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Browser session
            <button
              type="button"
              className="icon-button"
              aria-label={theme === "light" ? "Enable dark mode" : "Enable light mode"}
              title={theme === "light" ? "Dark mode" : "Light mode"}
              onClick={() =>
                setTheme((current) => (current === "light" ? "dark" : "light"))
              }
            >
              <Icon name={theme === "light" ? "moon" : "sun"} />
            </button>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-8">
          <section className="relative flex min-h-[68vh] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm lg:min-h-0">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-7">
              <div>
                <h1 className="text-base font-semibold">Your conversation</h1>
                <p className="mt-1 text-xs text-stone-500">
                  Answers are grounded in your indexed documents.
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Clear conversation"
                title="Clear conversation"
                disabled={chatBusy || messages.length === 0}
                onClick={handleClearConversation}
              >
                <Icon name="trash" />
              </button>
            </div>

            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="chat-scroll flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-7"
            >
              {messages.length === 0 && !chatBusy ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                  <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon name="upload" className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold">Start with a question</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
                    Upload a document, then ask for a summary or a specific detail.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <Message
                    key={`${index}-${message.role}`}
                    message={message}
                    onSuggestedQuestion={setQuestion}
                  />
                ))
              )}

              {chatBusy && (
                <div className="flex items-center gap-3" role="status" aria-live="polite">
                  <div className="message-avatar message-avatar-ai">R</div>
                  <div className="message-bubble message-bubble-ai flex items-center gap-2 py-4">
                    <span className="typing-dot" />
                    <span className="typing-dot animation-delay-150" />
                    <span className="typing-dot animation-delay-300" />
                    <span className="ml-2 text-sm text-stone-500">
                      Finding an answer…
                    </span>
                  </div>
                </div>
              )}
              <div ref={messageEndRef} />
            </div>
            {showScrollButton && (
              <button
                type="button"
                className="scroll-bottom-button"
                aria-label="Scroll to latest message"
                onClick={scrollToLatestMessage}
              >
                <Icon name="down" />
              </button>
            )}

            {(error || notice) && (
              <div
                className={`mx-4 mb-3 rounded-xl px-4 py-3 text-sm sm:mx-7 ${
                  error
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
                role={error ? "alert" : "status"}
              >
                {error || notice}
              </div>
            )}

            <form
              className="border-t border-stone-100 p-4 sm:px-7 sm:py-5"
              onSubmit={handleSubmit}
            >
              <label className="sr-only" htmlFor="question">
                Ask a question
              </label>
              <div className="flex items-end gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-2 pl-4 transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-600/10">
                <textarea
                  id="question"
                  className="max-h-36 min-h-11 flex-1 resize-y bg-transparent py-2.5 text-sm outline-none placeholder:text-stone-400"
                  dir="auto"
                  rows={1}
                  placeholder="Ask about your documents…"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form.requestSubmit();
                    }
                  }}
                />
                <button
                  className="primary-button mb-0.5"
                  type="submit"
                  disabled={chatBusy || question.trim().length === 0}
                  aria-label="Send question"
                >
                  {chatBusy ? (
                    <span className="button-spinner" />
                  ) : (
                    <Icon name="send" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
              <p className="mt-2 px-1 text-[11px] text-stone-400">
                Press Enter to send · Shift + Enter for a new line
              </p>
            </form>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Your documents</h2>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Upload files to make them searchable in chat.
                  </p>
                </div>
                <span className="count-badge">{documents.length}</span>
              </div>

              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept=".pdf,.txt,.md"
                multiple
                onChange={handleUpload}
                disabled={documentsBusy}
              />
              <button
                className="upload-button mt-5 w-full"
                type="button"
                disabled={documentsBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {documentsBusy ? (
                  <span className="button-spinner button-spinner-dark" />
                ) : (
                  <Icon name="upload" />
                )}
                {documentsBusy ? "Uploading and indexing…" : "Upload documents"}
              </button>
              <p className="mt-2 text-center text-[11px] text-stone-400">
                PDF, TXT, or MD · up to 5 MB each · 20 files
              </p>

              <div className="mt-5 border-t border-stone-100 pt-4">
                {documents.length === 0 ? (
                  <p className="py-3 text-center text-xs text-stone-400">
                    No documents uploaded yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {documents.map((document) => (
                      <li
                        key={document}
                        className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-50"
                      >
                        <span className="file-type-mark">
                          {document.split(".").pop()?.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-stone-700">
                          {document}
                        </span>
                        <button
                          className="icon-button icon-button-small"
                          type="button"
                          title={`Delete ${document}`}
                          aria-label={`Delete ${document}`}
                          disabled={documentAction === document}
                          onClick={() => handleDeleteDocument(document)}
                        >
                          {documentAction === document ? (
                            <span className="button-spinner button-spinner-dark" />
                          ) : (
                            <Icon name="trash" className="h-4 w-4" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <p className="px-2 text-xs leading-5 text-stone-400">
              Your conversation is associated with this browser. Clearing site
              storage starts a new session.
            </p>
          </aside>
        </div>

        <footer className="pb-5 text-center text-[11px] text-stone-400">
          Responses can make mistakes. Check important information against the source documents.
        </footer>
      </div>
    </main>
  );
}
