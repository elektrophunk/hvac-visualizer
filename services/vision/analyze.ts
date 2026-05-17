import Anthropic from "@anthropic-ai/sdk";
import { VISION_SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { validateAnalysis } from "./schema";
import type { AnalysisResult } from "@/types/analysis";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.ANTHROPIC_MODEL_ID ?? "claude-3-5-sonnet-20241022";
const MAX_INNER_RETRIES = 2;

interface AnalysisOutput {
  result: AnalysisResult;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

async function callClaude(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  equipmentSpec: string,
  attempt: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const userContent: Anthropic.MessageParam["content"] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: imageBase64,
      },
    },
    {
      type: "text",
      text:
        attempt > 1
          ? `Your previous response was not valid JSON. Output only raw JSON as specified.\n\n${buildUserMessage(equipmentSpec)}`
          : buildUserMessage(equipmentSpec),
    },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: VISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

function parseJson(text: string): unknown {
  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string,
  equipmentSpec: string
): Promise<AnalysisOutput> {
  const start = Date.now();
  const mediaType = mimeType.startsWith("image/png")
    ? "image/png"
    : mimeType.startsWith("image/webp")
    ? "image/webp"
    : "image/jpeg";

  const imageBase64 = imageBuffer.toString("base64");

  let lastError: Error = new Error("Unknown error");
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 1; attempt <= MAX_INNER_RETRIES + 1; attempt++) {
    try {
      const { text, inputTokens, outputTokens } = await callClaude(
        imageBase64,
        mediaType,
        equipmentSpec,
        attempt
      );
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      // Tier 1: JSON parse
      let parsed: unknown;
      try {
        parsed = parseJson(text);
      } catch (e) {
        lastError = new Error(`JSON parse failed: ${(e as Error).message}`);
        continue; // retry
      }

      // Tier 2+3: Zod validation with coercion
      const result = validateAnalysis(parsed);

      return {
        result,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt <= MAX_INNER_RETRIES) continue;
    }
  }

  throw lastError;
}
