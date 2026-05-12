#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionFiles = [
  path.join(rootDir, "browse", "dist", ".version"),
  path.join(rootDir, "design", "dist", ".version"),
  path.join(rootDir, "make-pdf", "dist", ".version"),
];

const gitResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: rootDir,
  encoding: "utf-8",
  timeout: 5000,
});

const version = gitResult.status === 0 ? gitResult.stdout.trim() : "";

for (const versionFile of versionFiles) {
  writeFileSync(versionFile, version ? `${version}\n` : "");
}