/**
 * Conversation history management utilities
 */

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

/**
 * Max conversation history size in tokens (approximate)
 * Using rough estimate of 4 chars = 1 token
 */
const MAX_HISTORY_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;
const MAX_HISTORY_CHARS = MAX_HISTORY_TOKENS * CHARS_PER_TOKEN;

/**
 * Trim conversation history to fit within token limits
 * Keeps most recent messages and removes oldest ones
 */
export function trimConversationHistory(
  history: ConversationMessage[]
): ConversationMessage[] {
  if (history.length === 0) return [];

  // Start with most recent messages
  let totalChars = 0;
  const trimmed: ConversationMessage[] = [];

  // Iterate from end (most recent) to start (oldest)
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    const messageChars = message.content.length + message.role.length;

    if (totalChars + messageChars > MAX_HISTORY_CHARS) {
      break; // Stop if adding this message would exceed limit
    }

    trimmed.unshift(message); // Add to beginning to maintain order
    totalChars += messageChars;
  }

  return trimmed;
}

/**
 * Remove old messages based on timestamp
 * Keeps messages from last X hours
 */
export function trimByAge(
  history: ConversationMessage[],
  hoursToKeep: number = 24
): ConversationMessage[] {
  const cutoffTime = Date.now() - hoursToKeep * 60 * 60 * 1000;

  return history.filter((msg) => {
    // Keep messages without timestamps
    if (!msg.timestamp) return true;
    // Keep messages newer than cutoff
    return msg.timestamp > cutoffTime;
  });
}

/**
 * Limit conversation history to last N messages
 */
export function trimToLastN(
  history: ConversationMessage[],
  count: number = 20
): ConversationMessage[] {
  if (history.length <= count) return history;
  return history.slice(-count);
}

/**
 * Smart cleanup: apply all trimming strategies
 */
export function smartTrimConversationHistory(
  history: ConversationMessage[],
  maxMessages: number = 20,
  hoursToKeep: number = 24
): ConversationMessage[] {
  // 1. Remove old messages
  let trimmed = trimByAge(history, hoursToKeep);

  // 2. Limit to max messages
  trimmed = trimToLastN(trimmed, maxMessages);

  // 3. Trim to token limits
  trimmed = trimConversationHistory(trimmed);

  return trimmed;
}

/**
 * Estimate tokens in a message (rough approximation)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check if conversation history is getting too large
 */
export function shouldCleanupHistory(history: ConversationMessage[]): boolean {
  const totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0);
  return totalChars > MAX_HISTORY_CHARS * 0.8; // Cleanup if 80% full
}

/**
 * Format conversation history for display
 */
export function formatHistory(history: ConversationMessage[]): string {
  return history
    .map((msg) => {
      const timestamp = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString()
        : "unknown";
      return `[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content.substring(
        0,
        100
      )}${msg.content.length > 100 ? "..." : ""}`;
    })
    .join("\n");
}
