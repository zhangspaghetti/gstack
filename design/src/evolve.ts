/**
 * Screenshot-to-Mockup Evolution.
 * Takes a screenshot of the live site and generates a mockup showing
 * how it SHOULD look based on a design brief.
 * Starts from reality, not blank canvas.
 */

import fs from "fs";
import path from "path";
import { getImageGenConfig, callImageGenApi, getVisionConfig, callVisionApi, getImageMimeType } from "./design-config";

export interface EvolveOptions {
  screenshot: string;  // Path to current site screenshot
  brief: string;       // What to change ("make it calmer", "fix the hierarchy")
  output: string;      // Output path for evolved mockup
}

/**
 * Generate an evolved mockup from an existing screenshot + brief.
 * Sends the screenshot as context to GPT-4o with image generation,
 * asking it to produce a new version incorporating the brief's changes.
 */
export async function evolve(options: EvolveOptions): Promise<void> {
  const imageConfig = getImageGenConfig();
  const visionConfig = getVisionConfig();
  const screenshotData = fs.readFileSync(options.screenshot).toString("base64");

  console.error(`Evolving ${options.screenshot} with: "${options.brief}"`);
  const startTime = Date.now();

  // Step 1: Analyze current screenshot
  const analysis = await analyzeScreenshot(visionConfig, screenshotData, options.screenshot);
  console.error(`  Analyzed current design: ${analysis.slice(0, 100)}...`);

  // Step 2: Generate evolved version using analysis + brief
  const evolvedPrompt = [
    "Generate a pixel-perfect UI mockup that is an improved version of an existing design.",
    "",
    "CURRENT DESIGN (what exists now):",
    analysis,
    "",
    "REQUESTED CHANGES:",
    options.brief,
    "",
    "Generate a new mockup that keeps the existing layout structure but applies the requested changes.",
    "The result should look like a real production UI. All text must be readable.",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const { imageData } = await callImageGenApi(imageConfig, evolvedPrompt, { signal: controller.signal });

    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    const imageBuffer = Buffer.from(imageData, "base64");
    fs.writeFileSync(options.output, imageBuffer);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`Generated (${elapsed}s, ${(imageBuffer.length / 1024).toFixed(0)}KB) → ${options.output}`);

    console.log(JSON.stringify({
      outputPath: options.output,
      sourceScreenshot: options.screenshot,
      brief: options.brief,
    }, null, 2));
  } finally {
    clearTimeout(timeout);
  }
}

import { VisionConfig } from "./design-config";

/**
 * Analyze a screenshot to produce a detailed description for re-generation.
 */
async function analyzeScreenshot(config: VisionConfig, imageBase64: string, imagePath: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    return await callVisionApi(config, [{
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${getImageMimeType(imagePath)};base64,${imageBase64}` },
        },
        {
          type: "text",
          text: `Describe this UI in detail for re-creation. Include: overall layout structure, color scheme (hex values), typography (sizes, weights), specific text content visible, spacing between elements, alignment patterns, and any decorative elements. Be precise enough that someone could recreate this UI from your description alone. 200 words max.`,
        },
      ],
    }], { signal: controller.signal, maxTokensOverride: 400 });
  } catch {
    return "Unable to analyze screenshot";
  } finally {
    clearTimeout(timeout);
  }
}
