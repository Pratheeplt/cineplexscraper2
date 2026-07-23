// Minimal Telegram Bot API client for sending notifications.
import { getSettings } from "./store";

interface TgResult {
  ok: boolean;
  description?: string;
}

async function callTelegram(token: string, method: string, body: unknown): Promise<TgResult> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as TgResult;
  if (!json.ok) {
    throw new Error(json.description || `Telegram ${method} failed (${res.status})`);
  }
  return json;
}

/** Send a Markdown message to the configured chat. Throws on failure. */
export async function sendTelegram(text: string): Promise<void> {
  const { telegramBotToken, telegramChatId } = getSettings();
  if (!telegramBotToken) throw new Error("Telegram bot token not configured");
  if (!telegramChatId) throw new Error("Telegram chat ID not configured — send /start to the bot first");
  await callTelegram(telegramBotToken, "sendMessage", {
    chat_id: telegramChatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
}

/**
 * Look at recent bot updates and return the most recent chat id that messaged
 * the bot. Used to auto-connect after the user sends /start.
 */
export async function detectChatId(token: string): Promise<string | null> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 100, allowed_updates: ["message"] }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok: boolean;
    description?: string;
    result?: Array<{ message?: { chat?: { id?: number } } }>;
  };
  if (!json.ok) throw new Error(json.description || "Telegram getUpdates failed");
  const updates = json.result ?? [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const id = updates[i]?.message?.chat?.id;
    if (typeof id === "number") return String(id);
  }
  return null;
}
