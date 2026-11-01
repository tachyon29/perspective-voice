import { backendFetch } from "./api";

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function requestAIReply(payload: {
  mode: "tutor" | "teammate";
  message: string;
  history: AIChatMessage[];
  context: Record<string, string>;
  persona?: string;
  role?: string;
}): Promise<string> {
  const response = await backendFetch("/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail ?? "The AI could not reply.");
  }
  if (typeof result.reply !== "string") {
    throw new Error("The AI returned an unexpected response.");
  }
  return result.reply;
}

export async function requestSarvamChat(payload: {
  mode: "tutor" | "teammate" | "consulting";
  message: string;
  history: AIChatMessage[];
  context: Record<string, string>;
  persona?: string;
  role?: string;
}): Promise<string> {
  const response = await backendFetch("/ai/sarvam-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail ?? "Sarvam could not reply.");
  if (typeof result.reply !== "string") throw new Error("Sarvam returned an unexpected response.");
  return result.reply;
}

