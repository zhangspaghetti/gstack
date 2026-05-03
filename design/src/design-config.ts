/**
 * Design tool provider configuration.
 *
 * Resolution order (highest priority first):
 * 1. Environment variables
 * 2. ~/.gstack/design.json
 * 3. Built-in defaults
 *
 * Quick-replace via config file — create ~/.gstack/design.json:
 * {
 *   "imageGen": {
 *     "provider": "dashscope",
 *     "apiKey": "sk-...",
 *     "baseUrl": "https://dashscope.aliyuncs.com/api/v1",
 *     "model": "qwen-image-2.0",
 *     "size": "2048*2048",
 *     "negativePrompt": "低分辨率，低画质，肢体畸形",
 *     "promptExtend": true,
 *     "watermark": false
 *   },
 *   "vision": {
 *     "apiKey": "sk-...",
 *     "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
 *     "model": "qwen3.6-flash",
 *     "maxTokens": 200
 *   }
 * }
 *
 * Switch to OpenAI / any OpenAI-compatible image gen provider:
 *   DESIGN_IMAGE_PROVIDER=openai
 *   DESIGN_IMAGE_API_KEY=sk-...
 *   DESIGN_IMAGE_BASE_URL=https://api.openai.com   (no /v1 suffix for OpenAI provider)
 *   DESIGN_IMAGE_MODEL=gpt-4o
 *
 * Environment variable overrides:
 *   DASHSCOPE_API_KEY             — shared key for both image gen and vision
 *   GSTACK_OPENAI_API_KEY         — shared OpenAI key (used as fallback)
 *   DESIGN_IMAGE_PROVIDER         — "dashscope" (default) or "openai"
 *   DESIGN_IMAGE_API_KEY          — override API key for image gen only
 *   DESIGN_IMAGE_BASE_URL         — e.g. https://dashscope.aliyuncs.com/api/v1
 *   DESIGN_IMAGE_MODEL            — e.g. qwen-image-2.0 or gpt-4o
 *   DESIGN_IMAGE_SIZE             — e.g. 2048*2048 or 1536x1024 (format depends on provider)
 *   DESIGN_IMAGE_NEGATIVE_PROMPT  — negative prompt text (DashScope only)
 *   DESIGN_IMAGE_PROMPT_EXTEND    — true/false (DashScope only)
 *   DESIGN_IMAGE_WATERMARK        — true/false (DashScope only)
 *   DESIGN_VISION_API_KEY         — override API key for vision only
 *   DESIGN_VISION_BASE_URL        — e.g. https://dashscope.aliyuncs.com/compatible-mode/v1
 *   DESIGN_VISION_MODEL           — e.g. qwen3.6-flash or gpt-4o
 *   DESIGN_VISION_MAX_TOKENS      — integer, default 200
 *   DESIGN_VISION_PROVIDER        — "openai" (default, Authorization Bearer + max_tokens)
 *                                    or "qwen" (same as openai but adds enable_thinking:false
 *                                       — recommended for Qwen3.6 hybrid models)
 *                                    or "mimo" (api-key header + max_completion_tokens)
 *
 * Use Qwen3.6-flash vision (recommended — disables thinking for clean fast responses):
 *   DESIGN_VISION_PROVIDER=qwen
 *   DASHSCOPE_API_KEY=sk-...
 *   # DESIGN_VISION_BASE_URL and DESIGN_VISION_MODEL default to qwen3.6-flash already
 *
 * Switch to Xiaomi MiMo vision:
 *   DESIGN_VISION_PROVIDER=mimo
 *   DESIGN_VISION_API_KEY=<mimo-api-key>
 *   DESIGN_VISION_BASE_URL=https://api.xiaomimimo.com/v1
 *   DESIGN_VISION_MODEL=mimo-v2.5
 */

import fs from "fs";
import path from "path";

/**
 * Return the correct MIME type for an image file based on its extension.
 * Used when building data-URI image_url values for vision API calls.
 */
export function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  return mimeMap[ext] ?? "image/png";
}

const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".gstack",
  "design.json",
);

interface DesignFileConfig {
  imageGen?: {
    provider?: "dashscope" | "openai";
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    size?: string;
    negativePrompt?: string;
    promptExtend?: boolean;
    watermark?: boolean;
  };
  vision?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    maxTokens?: number;
    visionProvider?: "openai" | "qwen" | "mimo";
  };
}

export interface ImageGenConfig {
  apiKey: string;
  /** Base URL of the image generation API (no trailing slash). */
  baseUrl: string;
  model: string;
  /** Image size in provider format. DashScope: "2048*2048". OpenAI: "1536x1024". */
  size: string;
  negativePrompt: string;
  promptExtend: boolean;
  watermark: boolean;
  /** API format: "dashscope" (default) or "openai" (OpenAI Responses API). */
  provider: "dashscope" | "openai";
}

export interface VisionConfig {
  apiKey: string;
  /** Base URL of the vision API (no trailing slash). */
  baseUrl: string;
  model: string;
  maxTokens: number;
  /**
   * Auth format + token-param name.
   * "openai" (default): Authorization Bearer header, max_tokens param.
   * "qwen":             Same as openai but adds enable_thinking:false (for Qwen3.6 hybrid models).
   * "mimo":             api-key header, max_completion_tokens param.
   */
  visionProvider: "openai" | "qwen" | "mimo";
}

function loadFileConfig(): DesignFileConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as DesignFileConfig;
    }
  } catch {
    // Missing or malformed file — fall through to defaults
  }
  return {};
}

function parseBoolEnv(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined) return fallback;
  return val === "true" || val === "1";
}

export function getImageGenConfig(): ImageGenConfig {
  const file = loadFileConfig();
  const provider = (process.env.DESIGN_IMAGE_PROVIDER as "dashscope" | "openai" | undefined)
    ?? file.imageGen?.provider
    ?? "dashscope";

  const apiKey =
    process.env.DESIGN_IMAGE_API_KEY
    ?? process.env.DASHSCOPE_API_KEY
    ?? (provider === "openai" ? process.env.GSTACK_OPENAI_API_KEY : undefined)
    ?? file.imageGen?.apiKey
    ?? "";

  if (!apiKey) {
    console.error("No image generation API key found.");
    console.error("Options:");
    if (provider === "openai") {
      console.error("  1. export GSTACK_OPENAI_API_KEY=sk-...");
    } else {
      console.error("  1. export DASHSCOPE_API_KEY=sk-...");
    }
    console.error(`  2. Add to ${CONFIG_PATH}: { "imageGen": { "apiKey": "sk-..." } }`);
    process.exit(1);
  }

  const defaultBaseUrl = provider === "openai"
    ? "https://api.openai.com"
    : "https://dashscope.aliyuncs.com/api/v1";
  const defaultSize = provider === "openai" ? "1536x1024" : "2048*2048";
  const defaultModel = provider === "openai" ? "gpt-4o" : "qwen-image-2.0";

  return {
    provider,
    apiKey,
    baseUrl:
      process.env.DESIGN_IMAGE_BASE_URL
      ?? file.imageGen?.baseUrl
      ?? defaultBaseUrl,
    model:
      process.env.DESIGN_IMAGE_MODEL
      ?? file.imageGen?.model
      ?? defaultModel,
    size:
      process.env.DESIGN_IMAGE_SIZE
      ?? file.imageGen?.size
      ?? defaultSize,
    negativePrompt:
      process.env.DESIGN_IMAGE_NEGATIVE_PROMPT
      ?? file.imageGen?.negativePrompt
      ?? "",
    promptExtend: parseBoolEnv(
      process.env.DESIGN_IMAGE_PROMPT_EXTEND,
      file.imageGen?.promptExtend ?? true,
    ),
    watermark: parseBoolEnv(
      process.env.DESIGN_IMAGE_WATERMARK,
      file.imageGen?.watermark ?? false,
    ),
  };
}

export function getVisionConfig(): VisionConfig {
  const file = loadFileConfig();
  const visionProvider = (process.env.DESIGN_VISION_PROVIDER as "openai" | "qwen" | "mimo" | undefined)
    ?? file.vision?.visionProvider
    ?? "openai";
  const apiKey =
    process.env.DESIGN_VISION_API_KEY
    ?? process.env.DASHSCOPE_API_KEY
    ?? process.env.GSTACK_OPENAI_API_KEY
    ?? file.vision?.apiKey
    ?? "";

  if (!apiKey) {
    console.error("No vision API key found.");
    console.error("Options:");
    console.error("  1. export DASHSCOPE_API_KEY=sk-...");
    console.error(`  2. Add to ${CONFIG_PATH}: { "vision": { "apiKey": "sk-..." } }`);
    process.exit(1);
  }

  return {
    apiKey,
    baseUrl:
      process.env.DESIGN_VISION_BASE_URL
      ?? file.vision?.baseUrl
      ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model:
      process.env.DESIGN_VISION_MODEL
      ?? file.vision?.model
      ?? "qwen3.6-flash",
    maxTokens:
      (parseInt(process.env.DESIGN_VISION_MAX_TOKENS ?? "", 10) || (file.vision?.maxTokens ?? 200)),
    visionProvider,
  };
}

/**
 * Make an image generation API call.
 * Dispatches based on config.provider:
 *   "dashscope" (default): DashScope multimodal-generation API
 *   "openai":              OpenAI Responses API (also works with compatible providers)
 *
 * Returns { responseId, imageData } where imageData is base64-encoded PNG.
 */
export async function callImageGenApi(
  config: ImageGenConfig,
  prompt: string,
  opts?: { size?: string; quality?: string; signal?: AbortSignal },
): Promise<{ responseId: string; imageData: string }> {
  const size = opts?.size ?? config.size;

  if (config.provider === "openai") {
    // OpenAI / OpenAI-compatible Responses API
    const response = await fetch(`${config.baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: prompt,
        tools: [{ type: "image_generation", size, quality: opts?.quality ?? "high" }],
      }),
      signal: opts?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error.slice(0, 300)}`);
    }

    const data = await response.json() as any;
    const imageItem = data.output?.find((item: any) => item.type === "image_generation_call");
    if (!imageItem?.result) throw new Error("No image data in response");
    return { responseId: data.id as string, imageData: imageItem.result as string };
  } else {
    // DashScope multimodal-generation API
    const parameters: Record<string, unknown> = {
      size,
      prompt_extend: config.promptExtend,
      watermark: config.watermark,
    };
    if (config.negativePrompt) parameters.negative_prompt = config.negativePrompt;

    const response = await fetch(
      `${config.baseUrl}/services/aigc/multimodal-generation/generation`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          input: { messages: [{ role: "user", content: [{ text: prompt }] }] },
          parameters,
        }),
        signal: opts?.signal,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error.slice(0, 300)}`);
    }

    const data = await response.json() as any;
    const imageUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image as string | undefined;
    if (!imageUrl) {
      const msg = data.code ? `${data.code}: ${data.message}` : "No image URL in response";
      throw new Error(msg);
    }

    // Download image URL → base64
    const imgRes = await fetch(imageUrl, { signal: opts?.signal });
    if (!imgRes.ok) throw new Error(`Image download failed (${imgRes.status})`);
    const buf = await imgRes.arrayBuffer();
    return { responseId: "", imageData: Buffer.from(buf).toString("base64") };
  }
}

/**
 * Make a vision (image understanding) API call.
 * Handles auth header and token-param differences between providers:
 *   "openai" (default): Authorization: Bearer, max_tokens
 *   "qwen":             Authorization: Bearer, max_tokens, enable_thinking:false
 *                       (suppresses thinking mode for Qwen3.6 hybrid models like qwen3.6-flash)
 *   "mimo":             api-key, max_completion_tokens
 *
 * Returns the text content from the first choice.
 * Throws on non-ok HTTP status.
 */
export async function callVisionApi(
  config: VisionConfig,
  messages: { role: string; content: unknown }[],
  opts?: {
    signal?: AbortSignal;
    /** Override max tokens for this call (falls back to config.maxTokens). */
    maxTokensOverride?: number;
    /** Include response_format in request (e.g. { type: "json_object" }). */
    responseFormat?: { type: string };
  },
): Promise<string> {
  const maxT = opts?.maxTokensOverride ?? config.maxTokens;
  const tokensKey = config.visionProvider === "mimo" ? "max_completion_tokens" : "max_tokens";
  const authHeader: Record<string, string> = config.visionProvider === "mimo"
    ? { "api-key": config.apiKey }
    : { "Authorization": `Bearer ${config.apiKey}` };

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    [tokensKey]: maxT,
  };
  if (opts?.responseFormat) body.response_format = opts.responseFormat;
  // Suppress thinking mode for Qwen3.6 hybrid models (avoids verbose reasoning_content
  // in responses, especially important for JSON-output tasks).
  if (config.visionProvider === "qwen") body.enable_thinking = false;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vision API error (${response.status}): ${error.slice(0, 300)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || "";
}
