import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const compatibilitySource = await readFile(new URL("../src/admin-compatibility.ts", import.meta.url), "utf8");

const packageName = "@sprengmeister/graphvault";
const recommendedVersion = extractRecommendedVersion(compatibilitySource);
const dependencyRange = packageJson.dependencies?.[packageName];
const lockDependencyRange = packageLock.packages?.[""]?.dependencies?.[packageName];
const lockedVersion = packageLock.packages?.[`node_modules/${packageName}`]?.version;

assert.equal(typeof recommendedVersion, "string", "Could not read recommended GraphVault Library version.");
assert.equal(typeof dependencyRange, "string", `${packageName} dependency is missing from package.json.`);
assert.equal(lockDependencyRange, dependencyRange, "package-lock.json root dependency range must match package.json.");
assert.equal(
  rangeAcceptsVersion(dependencyRange, recommendedVersion),
  true,
  `${packageName} dependency range "${dependencyRange}" must accept recommended version ${recommendedVersion}.`,
);

if (typeof lockedVersion === "string" && compareVersions(lockedVersion, recommendedVersion) < 0) {
  console.warn(`${packageName} lockfile currently resolves to ${lockedVersion}; recommended runtime is ${recommendedVersion}.`);
}

console.log(`GraphVault Studio compatibility check passed for ${packageName} ${dependencyRange}; recommended ${recommendedVersion}.`);

function extractRecommendedVersion(source) {
  return source.match(/RECOMMENDED_GRAPHVAULT_VERSION\s*=\s*"([^"]+)"/)?.[1];
}

function rangeAcceptsVersion(range, version) {
  const trimmed = range.trim();
  if (trimmed === version || trimmed === "*" || trimmed === "latest") {
    return true;
  }
  if (trimmed.startsWith("^")) {
    const base = trimmed.slice(1);
    const [major] = parseVersion(base);
    return compareVersions(version, base) >= 0 && parseVersion(version)[0] === major;
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 0 && parts.every((part) => /^[<>]=?/.test(part))) {
    return parts.every((part) => comparatorAccepts(part, version));
  }
  return false;
}

function comparatorAccepts(comparator, version) {
  const match = comparator.match(/^(>=|>|<=|<)(.+)$/);
  if (!match) {
    return false;
  }
  const comparison = compareVersions(version, match[2]);
  switch (match[1]) {
    case ">=":
      return comparison >= 0;
    case ">":
      return comparison > 0;
    case "<=":
      return comparison <= 0;
    case "<":
      return comparison < 0;
  }
  return false;
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < 3; index++) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function parseVersion(version) {
  return version
    .replace(/^[^\d]*/, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}
