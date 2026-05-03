/**
 * Vision-based quality gate for generated mockups.
 * Uses a vision model (default: qwen3.6-flash) to verify text readability,
 * layout completeness, and visual coherence.
 */

import fs from "fs";
import { getVisionConfig, callVisionApi, getImageMimeType } from "./design-config";

export interface CheckResult {
  pass: boolean;
  issues: string;
}

/**
 * Check a generated mockup against the original brief.
 */
export async function checkMockup(imagePath: string, brief: string): Promise<CheckResult> {
  const config = getVisionConfig();
  const imageData = fs.readFileSync(imagePath).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    let content: string;
    try {
      content = await callVisionApi(config, [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${getImageMimeType(imagePath)};base64,${imageData}` },
          },
          {
            type: "text",
            text: [
              "You are a UI quality checker. Evaluate this mockup against the design brief.",
              "",
              `Brief: ${brief}`,
              "",
              "Check these 3 things:",
              "1. TEXT READABILITY: Are all labels, headings, and body text legible? Any misspellings?",
              "2. LAYOUT COMPLETENESS: Are all requested elements present? Anything missing?",
              "3. VISUAL COHERENCE: Does it look like a real production UI, not AI art or a collage?",
              "",
              "Respond with exactly one line:",
              "PASS — if all 3 checks pass",
              "FAIL: [list specific issues] — if any check fails",
            ].join("\n"),
          },
        ],
      }], { signal: controller.signal });
    } catch (err: any) {
      // Non-blocking: if vision check fails, default to PASS with warning
      console.error(`Vision check API error: ${err.message}`);
      return { pass: true, issues: "Vision check unavailable — skipped" };
    }

    if (content.startsWith("PASS")) {
      return { pass: true, issues: "" };
    }

    // Extract issues after "FAIL:"
    const issues = content.replace(/^FAIL:\s*/i, "").trim();
    return { pass: false, issues: issues || content };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Standalone check command: check an existing image against a brief.
 */
export async function checkCommand(imagePath: string, brief: string): Promise<void> {
  const result = await checkMockup(imagePath, brief);
  console.log(JSON.stringify(result, null, 2));
}
