# Windows Bun Setup Findings

Date: 2026-05-12

## Issue

Running `./setup --host opencode` from Git Bash on Windows failed after the Node server bundle was generated:

```text
Node server bundle ready: /c/Users/zhang/.claude/skills/gstack/browse/dist/server-node.mjs
bun: command not found: {
bun: command not found: }
bun: command not found: }
bun: command not found: }
error: script "build" exited with code 1
```

## Root Cause

The failure was not in the OpenCode-specific install path.

`setup` calls `bun run build`, and the `build` script in `package.json` previously ended with shell brace groups like:

```text
{ git rev-parse HEAD 2>/dev/null || true; } > browse/dist/.version
```

On Windows with Bun 1.3.12, Bun's package-script shell rejected that brace-group syntax and treated `{` / `}` as commands. The build had already completed all expensive steps, then failed during the `.version` metadata write.

## Evidence

- Full repro on the affected machine: `bun run build` failed immediately after `Node server bundle ready...`.
- Minimal repro: `bun exec '{ echo ok; }'` failed with the same `command not found: {` error.
- Post-failure artifact check showed the main binaries and `.opencode/skills/*` outputs existed, but `browse/dist/.version`, `design/dist/.version`, and `make-pdf/dist/.version` were missing.
- `browse/scripts/build-node-server.sh` uses brace grouping too, but it succeeds because it runs under `bash`, not Bun's package-script parser.

## Fix

Replaced inline brace-group version writes in `package.json` with a dedicated cross-platform script:

- `scripts/write-build-versions.ts`

That script:

- runs `git rev-parse HEAD`
- writes the result to the three `.version` files
- preserves previous behavior when Git is unavailable by writing an empty file instead of failing the build

## Validation

Validated on the same Windows machine and Bun runtime:

1. `bun run build`
   - completed successfully
   - generated all three `.version` files

2. `./setup --host opencode -q`
   - completed successfully
   - printed `gstack ready (opencode)`

## Second-Opinion Follow-Up

An independent read-only scan flagged a few adjacent Windows risks. Most of the `package.json` shell-syntax warnings were false positives in this environment because the fixed Windows build successfully executed:

- `mkdir -p`
- `cp`
- `chmod +x`
- `2>/dev/null || ...`

One adjacent portability caveat still stands:

- `browse/scripts/build-node-server.sh` depends on `perl` for two in-place substitutions. This worked in the current Git Bash environment, but it remains a portability dependency worth revisiting if Windows support needs to work outside MSYS/Git Bash setups.

## Recommended Next Step

If Windows support is expected outside Git Bash, the next cleanup is to replace the `perl -pi` post-processing in `browse/scripts/build-node-server.sh` with a small JS/TS transformer so the Node bundle path is fully shell-portable.