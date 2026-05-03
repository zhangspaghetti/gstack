/**
 * Visual diff between two mockups using GPT-4o vision.
 * Identifies what changed between design iterations or between
 * an approved mockup and the live implementation.
 */

import fs from "fs";
import { getVisionConfig, callVisionApi, getImageMimeType } from "./design-config";

export interface DiffResult {
  differences: { area: string; description: string; severity: string }[];
  summary: string;
  matchScore: number; // 0-100, how closely they match
}

/**
 * Compare two images and describe the visual differences.
 */
export async function diffMockups(
  beforePath: string,
  afterPath: string,
): Promise<DiffResult> {
  const config = getVisionConfig();
  const beforeData = fs.readFileSync(beforePath).toString("base64");
  const afterData = fs.readFileSync(afterPath).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const content = await callVisionApi(config, [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Compare these two UI images. The first is the BEFORE (or design intent), the second is the AFTER (or actual implementation). Return valid JSON only:

{
  "differences": [
    {"area": "header", "description": "Font size changed from ~32px to ~24px", "severity": "high"},
    ...
  ],
  "summary": "one sentence overall assessment",
  "matchScore": 85
}

severity: "high" = noticeable to any user, "medium" = visible on close inspection, "low" = minor/pixel-level.
matchScore: 100 = identical, 0 = completely different.
Focus on layout, typography, colors, spacing, and element presence/absence. Ignore rendering differences (anti-aliasing, sub-pixel).`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${getImageMimeType(beforePath)};base64,${beforeData}` },
        },
        {
          type: "image_url",
          image_url: { url: `data:${getImageMimeType(afterPath)};base64,${afterData}` },
        },
      ],
    }], {
      signal: controller.signal,
      maxTokensOverride: config.maxTokens > 200 ? config.maxTokens : 600,
      responseFormat: { type: "json_object" },
    });
    return JSON.parse(content) as DiffResult;
  } catch (err: any) {
    console.error(`Diff API error: ${err.message}`);
    return { differences: [], summary: "Diff unavailable", matchScore: -1 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verify a live implementation against an approved design mockup.
 * Combines diff with a pass/fail gate.
 */
export async function verifyAgainstMockup(
  mockupPath: string,
  screenshotPath: string,
): Promise<{ pass: boolean; matchScore: number; diff: DiffResult }> {
  const diff = await diffMockups(mockupPath, screenshotPath);

  // Pass if matchScore >= 70 and no high-severity differences
  const highSeverity = diff.differences.filter(d => d.severity === "high");
  const pass = diff.matchScore >= 70 && highSeverity.length === 0;

  return { pass, matchScore: diff.matchScore, diff };
}
