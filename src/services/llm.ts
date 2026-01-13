import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export type LLMProvider = "gemini" | "gpt" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseURL?: string; // for Ollama or custom endpoints
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class LLMService {
  private config: LLMConfig;
  private geminiClient?: GoogleGenerativeAI;
  private openaiClient?: OpenAI;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeClient();
  }

  private initializeClient() {
    switch (this.config.provider) {
      case "gemini":
        const geminiKey =
          this.config.apiKey || process.env.GEMINI_API_KEY || "";
        if (!geminiKey) {
          throw new Error("Gemini API key is required");
        }
        this.geminiClient = new GoogleGenerativeAI(geminiKey);
        break;

      case "gpt":
        const openaiKey =
          this.config.apiKey || process.env.OPENAI_API_KEY || "";
        if (!openaiKey) {
          throw new Error("OpenAI API key is required");
        }
        this.openaiClient = new OpenAI({
          apiKey: openaiKey,
        });
        break;

      case "ollama":
        this.openaiClient = new OpenAI({
          apiKey: "ollama", // Ollama doesn't require a real API key
          baseURL:
            this.config.baseURL ||
            process.env.OLLAMA_BASE_URL ||
            "http://localhost:11434/v1",
        });
        break;
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    switch (this.config.provider) {
      case "gemini":
        return this.chatWithGemini(messages);
      case "gpt":
      case "ollama":
        return this.chatWithOpenAI(messages);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
    switch (this.config.provider) {
      case "gemini":
        yield* this.chatStreamGemini(messages);
        break;
      case "gpt":
      case "ollama":
        yield* this.chatStreamOpenAI(messages);
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async chatWithGemini(messages: ChatMessage[]): Promise<string> {
    if (!this.geminiClient) {
      throw new Error("Gemini client not initialized");
    }

    const modelName = this.config.model || "gemini-2.5-flash";
    const model = this.geminiClient.getGenerativeModel({ model: modelName });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
      generationConfig: {
        temperature: this.config.temperature || 0.7,
        maxOutputTokens: this.config.maxTokens || 2048,
      },
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    return response.text();
  }

  private async *chatStreamGemini(
    messages: ChatMessage[]
  ): AsyncGenerator<string> {
    if (!this.geminiClient) {
      throw new Error("Gemini client not initialized");
    }

    const modelName = this.config.model || "gemini-pro";
    const model = this.geminiClient.getGenerativeModel({ model: modelName });

    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
      generationConfig: {
        temperature: this.config.temperature || 0.7,
        maxOutputTokens: this.config.maxTokens || 2048,
      },
    });

    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      yield chunkText;
    }
  }

  private async chatWithOpenAI(messages: ChatMessage[]): Promise<string> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized");
    }

    const modelName =
      this.config.model ||
      (this.config.provider === "gpt" ? "gpt-4" : "llama2");

    const completion = await this.openaiClient.chat.completions.create({
      model: modelName,
      messages: messages as any,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 2048,
    });

    return completion.choices[0]?.message?.content || "";
  }

  private async *chatStreamOpenAI(
    messages: ChatMessage[]
  ): AsyncGenerator<string> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized");
    }

    const modelName =
      this.config.model ||
      (this.config.provider === "gpt" ? "gpt-4" : "llama2");

    const stream = await this.openaiClient.chat.completions.create({
      model: modelName,
      messages: messages as any,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield content;
      }
    }
  }
}
