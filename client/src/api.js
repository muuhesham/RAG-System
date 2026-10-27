const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

async function request(path, options) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error(
      "Couldn't reach the server. Check your connection and try again.",
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Too many requests. Please wait a minute before trying again.",
      );
    }

    throw new Error(
      payload.message ??
        payload.error ??
        `Request failed with status ${response.status}.`,
    );
  }

  return payload;
}

export function sendQuestion(question, sessionId) {
  return request("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, sessionId }),
  });
}

export function clearConversation(sessionId) {
  return request(`/chat/history/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export function listDocuments() {
  return request("/documents");
}

export function uploadDocuments(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("documents", file);
  }

  return request("/documents", {
    method: "POST",
    body: formData,
  });
}

export function deleteDocument(fileName) {
  return request(`/documents/${encodeURIComponent(fileName)}`, {
    method: "DELETE",
  });
}
