import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = dirname(root);
const siblingLibraryRoot = join(workspaceRoot, "graphvault-library");
const temp = await mkdtemp(join(tmpdir(), "graphvault-studio-package-smoke-"));
const tarballs = [];

try {
  const studioTarball = packPackage(root, join(temp, "studio-pack-cache"));
  tarballs.push(studioTarball);

  const dependencies = {};
  if (await exists(join(siblingLibraryRoot, "package.json"))) {
    const libraryTarball = packPackage(siblingLibraryRoot, join(temp, "library-pack-cache"));
    tarballs.push(libraryTarball);
    dependencies["@sprengmeister/graphvault"] = `file:${libraryTarball}`;
  }
  dependencies["graphvault-studio"] = `file:${studioTarball}`;

  await writeFile(join(temp, "package.json"), JSON.stringify({ type: "module", private: true, dependencies }, null, 2));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(temp, ".npm-cache")], {
    cwd: temp,
    stdio: "inherit",
  });

  const cliPath = join(temp, "node_modules", ".bin", process.platform === "win32" ? "graphvault-studio.cmd" : "graphvault-studio");
  const help = execFileSync(cliPath, ["--help"], { cwd: temp, encoding: "utf8" });
  assertIncludes(help, "Usage: graphvault-studio");
  assertIncludes(help, "--dir");
  assertIncludes(help, "--port");
  assertIncludes(help, "--allow-mutations");
  assertIncludes(help, "--doctor");

  await writeFile(
    join(temp, "smoke.mjs"),
    `
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EmbeddedStorage } from "@sprengmeister/graphvault";
import { StorageAdminClient, startAdminServer } from "graphvault-studio";

const storageDirectory = await mkdtemp(join(tmpdir(), "graphvault-studio-package-store-"));

try {
  const storage = await EmbeddedStorage.start({
    storageDirectory,
    rootFactory: () => ({
      workspace: "Package smoke",
      documents: [{ id: "doc-1", title: "Install verification", status: "ready" }],
    }),
  });
  await storage.storeRoot();
  await storage.shutdown();

  assert.equal(typeof startAdminServer, "function");

  const client = new StorageAdminClient({ storageDirectory });
  const summary = await client.summary({ verify: false });
  assert.equal(summary.objectCount >= 2, true);
  assert.equal(summary.library.packageName, "@sprengmeister/graphvault");
  assert.equal(summary.library.recommendedVersion, "0.2.0");

  const rootReference = await client.rootReference();
  assert.equal(typeof rootReference.rootObjectId, "string");

  const rootOnly = await client.subtree({ depth: 0 });
  assert.equal(rootOnly.objectIds.length, 1);
  assert.equal(rootOnly.complete, false);

  const rootSlice = await client.subtree({ rootObjectId: rootReference.rootObjectId, depth: 1 });
  assert.equal(rootSlice.objectIds.length > rootOnly.objectIds.length, true);
  assert.equal(rootSlice.edges.some((edge) => edge.from === rootReference.rootObjectId), true);

  const results = await client.search("Install verification");
  assert.equal(results.length > 0, true);

  const doctorJson = execFileSync(join(".", "node_modules", ".bin", process.platform === "win32" ? "graphvault-studio.cmd" : "graphvault-studio"), ["--dir", storageDirectory, "--doctor", "--json"], { encoding: "utf8" });
  const doctor = JSON.parse(doctorJson);
  assert.equal(doctor.ok, true);
  assert.equal(doctor.summary.objectCount >= 2, true);
} finally {
  await rm(storageDirectory, { recursive: true, force: true });
}
`,
  );
  execFileSync("node", ["smoke.mjs"], { cwd: temp, stdio: "inherit" });
  console.log("GraphVault Studio package smoke test passed.");
} finally {
  await rm(temp, { recursive: true, force: true });
  await Promise.all(tarballs.map((tarball) => rm(tarball, { force: true })));
}

function packPackage(packageRoot, cache) {
  const packOutput = execFileSync("npm", ["pack", "--json", "--cache", cache], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const [packed] = JSON.parse(packOutput);
  return join(packageRoot, packed.filename);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected CLI help to include "${expected}". Received:\n${value}`);
  }
}
