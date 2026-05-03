/**
 * Generate N design variants from a brief.
 * Uses staggered parallel: 1s delay between API calls to avoid rate limits.
 * Falls back to exponential backoff on 429s.
 */

import fs from "fs";
import path from "path";
import { getImageGenConfig, callImageGenApi, type ImageGenConfig } from "./design-config";
import { parseBrief } from "./brief";

export interface VariantsOptions {
  brief?: string;
  briefFile?: string;
  count: number;
  outputDir: string;
  size?: string;
  quality?: string;
  viewports?: string; // "desktop,tablet,mobile" — generates at multiple sizes
}

const STYLE_VARIATIONS = [
  "", // First variant uses the brief as-is
  "Use a bolder, more dramatic visual style with stronger contrast and larger typography.",
  "Use a calmer, more minimal style with generous whitespace and subtle colors.",
  "Use a warmer, more approachable style with rounded corners and friendly typography.",
  "Use a more professional, corporate style with sharp edges and structured grid layout.",
  "Use a dark theme with light text and accent colors for key interactive elements.",
  "Use a playful, modern style with asymmetric layout and unexpected color accents.",
];

/**
 * Generate a single variant with retry on rate-limit (429).
 */
async function generateVariant(
  config: ImageGenConfig,
  prompt: string,
  outputPath: string,
  sizeOverride?: string,
): Promise<{ path: string; success: boolean; error?: string }> {
  const maxRetries = 3;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000;
      console.error(`  Rate limited, retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const { imageData } = await callImageGenApi(config, prompt, {
        size: sizeOverride,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      fs.writeFileSync(outputPath, Buffer.from(imageData, "base64"));
      return { path: outputPath, success: true };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return { path: outputPath, success: false, error: "Timeout (120s)" };
      }
      // Retry on rate limit
      if (err.message?.includes("429") || err.message?.toLowerCase().includes("rate")) {
        lastError = "Rate limited";
        continue;
      }
      return { path: outputPath, success: false, error: err.message };
    }
  }

  return { path: outputPath, success: false, error: lastError };
}

/**
 * Generate N variants with staggered parallel execution.
 */
export async function variants(options: VariantsOptions): Promise<void> {
  const config = getImageGenConfig();
  const baseBrief = options.briefFile
    ? parseBrief(options.briefFile, true)
    : parseBrief(options.brief!, false);

  fs.mkdirSync(options.outputDir, { recursive: true });

  // If viewports specified, generate responsive variants instead of style variants
  if (options.viewports) {
    await generateResponsiveVariants(config, baseBrief, options.outputDir, options.viewports);
    return;
  }

  const count = Math.min(options.count, 7); // Cap at 7 style variations
  const size = options.size;

  console.error(`Generating ${count} variants...`);
  const startTime = Date.now();

  // Staggered parallel: start each call 1.5s apart
  const promises: Promise<{ path: string; success: boolean; error?: string }>[] = [];

  for (let i = 0; i < count; i++) {
    const variation = STYLE_VARIATIONS[i] || "";
    const prompt = variation
      ? `${baseBrief}\n\nStyle direction: ${variation}`
      : baseBrief;

    const outputPath = path.join(options.outputDir, `variant-${String.fromCharCode(65 + i)}.png`);

    // Stagger: wait 1.5s between launches
    const delay = i * 1500;
    promises.push(
      new Promise(resolve => setTimeout(resolve, delay))
        .then(() => {
          console.error(`  Starting variant ${String.fromCharCode(65 + i)}...`);
          return generateVariant(config, prompt, outputPath, size);
        })
    );
  }

  const results = await Promise.allSettled(promises);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      const size = fs.statSync(result.value.path).size;
      console.error(`  ✓ ${path.basename(result.value.path)} (${(size / 1024).toFixed(0)}KB)`);
      succeeded.push(result.value.path);
    } else {
      const error = result.status === "fulfilled" ? result.value.error : (result.reason as Error).message;
      const filePath = result.status === "fulfilled" ? result.value.path : "unknown";
      console.error(`  ✗ ${path.basename(filePath)}: ${error}`);
      failed.push(path.basename(filePath));
    }
  }

  console.error(`\n${succeeded.length}/${count} variants generated (${elapsed}s)`);

  // Output structured result to stdout
  console.log(JSON.stringify({
    outputDir: options.outputDir,
    count,
    succeeded: succeeded.length,
    failed: failed.length,
    paths: succeeded,
    errors: failed,
  }, null, 2));
}

// Qwen-compatible recommended sizes for common viewport shapes
const VIEWPORT_CONFIGS: Record<string, { size: string; suffix: string; desc: string }> = {
  desktop: { size: "2688*1536", suffix: "desktop", desc: "Desktop (2688*1536, 16:9)" },
  tablet: { size: "2048*2048", suffix: "tablet", desc: "Tablet (2048*2048, 1:1)" },
  mobile: { size: "1536*2688", suffix: "mobile", desc: "Mobile (1536*2688, 9:16 portrait)" },
};

async function generateResponsiveVariants(
  config: ImageGenConfig,
  baseBrief: string,
  outputDir: string,
  viewports: string,
): Promise<void> {
  const viewportList = viewports.split(",").map(v => v.trim().toLowerCase());
  const configs = viewportList.map(v => VIEWPORT_CONFIGS[v]).filter(Boolean);

  if (configs.length === 0) {
    console.error(`No valid viewports. Use: desktop, tablet, mobile`);
    process.exit(1);
  }

  console.error(`Generating responsive variants: ${configs.map(c => c.desc).join(", ")}...`);
  const startTime = Date.now();

  const promises = configs.map((vpConfig, i) => {
    const prompt = `${baseBrief}\n\nViewport: ${vpConfig.desc}. Adapt the layout for this screen size. ${
      vpConfig.suffix === "mobile" ? "Use a single-column layout, larger touch targets, and mobile navigation patterns." :
      vpConfig.suffix === "tablet" ? "Use a responsive layout that works for medium screens." :
      ""
    }`;
    const outputPath = path.join(outputDir, `responsive-${vpConfig.suffix}.png`);
    const delay = i * 1500;

    return new Promise<{ path: string; success: boolean; error?: string }>(resolve =>
      setTimeout(resolve, delay)
    ).then(() => {
      console.error(`  Starting ${vpConfig.desc}...`);
      return generateVariant(config, prompt, outputPath, vpConfig.size);
    });
  });

  const results = await Promise.allSettled(promises);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const succeeded: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      const sz = fs.statSync(result.value.path).size;
      console.error(`  ✓ ${path.basename(result.value.path)} (${(sz / 1024).toFixed(0)}KB)`);
      succeeded.push(result.value.path);
    } else {
      const error = result.status === "fulfilled" ? result.value.error : (result.reason as Error).message;
      console.error(`  ✗ ${error}`);
    }
  }

  console.error(`\n${succeeded.length}/${configs.length} responsive variants generated (${elapsed}s)`);
  console.log(JSON.stringify({
    outputDir,
    viewports: viewportList,
    succeeded: succeeded.length,
    paths: succeeded,
  }, null, 2));
}
