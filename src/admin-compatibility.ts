import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { AdminLibraryCompatibility } from "./admin-types.js";

const RECOMMENDED_GRAPHVAULT_VERSION = "0.2.0";

export function graphvaultLibraryCompatibility(): AdminLibraryCompatibility {
  const installedVersion = readInstalledGraphVaultVersion();
  const warnings: string[] = [];
  if (!installedVersion) {
    warnings.push("Could not determine installed GraphVault Library version.");
  } else if (compareSemver(installedVersion, RECOMMENDED_GRAPHVAULT_VERSION) < 0) {
    warnings.push(`GraphVault Library ${installedVersion} is older than the recommended ${RECOMMENDED_GRAPHVAULT_VERSION}.`);
  }
  return {
    packageName: "@sprengmeister/graphvault",
    recommendedVersion: RECOMMENDED_GRAPHVAULT_VERSION,
    status: warnings.length ? "warning" : "ok",
    warnings,
    ...(installedVersion ? { installedVersion } : {}),
  };
}

function readInstalledGraphVaultVersion(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("@sprengmeister/graphvault");
    const packageJsonPath = join(dirname(dirname(entry)), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
    return typeof packageJson.version === "string" ? packageJson.version : undefined;
  } catch {
    return undefined;
  }
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index++) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function parseSemver(value: string): number[] {
  return value
    .replace(/^[^\d]*/, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}
