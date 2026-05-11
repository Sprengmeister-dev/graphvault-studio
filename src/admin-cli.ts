#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startAdminServer } from "./admin-server.js";
import { StorageAdminClient } from "./admin-client.js";
import type { AdminSummary, StorageAdminClientOptions } from "./admin-types.js";

export interface ParsedAdminCliArgs {
  storageDirectory?: string;
  host: string;
  port: number;
  allowMutations: boolean;
  authToken?: string;
  viewerToken?: string;
  operatorToken?: string;
  adminToken?: string;
  mutationConfirmToken?: string;
  doctor: boolean;
  json: boolean;
  help: boolean;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4177;

export function parseAdminCliArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): ParsedAdminCliArgs {
  const parsed: ParsedAdminCliArgs = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    allowMutations: false,
    doctor: false,
    json: false,
    help: false,
  };
  if (env["GRAPHVAULT_ADMIN_TOKEN"]) {
    parsed.authToken = env["GRAPHVAULT_ADMIN_TOKEN"];
  }
  if (env["GRAPHVAULT_VIEWER_TOKEN"]) {
    parsed.viewerToken = env["GRAPHVAULT_VIEWER_TOKEN"];
  }
  if (env["GRAPHVAULT_OPERATOR_TOKEN"]) {
    parsed.operatorToken = env["GRAPHVAULT_OPERATOR_TOKEN"];
  }
  if (env["GRAPHVAULT_ADMIN_ROLE_TOKEN"]) {
    parsed.adminToken = env["GRAPHVAULT_ADMIN_ROLE_TOKEN"];
  }
  if (env["GRAPHVAULT_ADMIN_CONFIRM_TOKEN"]) {
    parsed.mutationConfirmToken = env["GRAPHVAULT_ADMIN_CONFIRM_TOKEN"];
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--allow-mutations") {
      parsed.allowMutations = true;
      continue;
    }
    if (arg === "--doctor") {
      parsed.doctor = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--dir" || arg === "--storage-directory") {
      parsed.storageDirectory = readValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--host") {
      parsed.host = readValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--port") {
      parsed.port = parsePort(readValue(argv, ++index, arg));
      continue;
    }
    if (arg === "--token" || arg === "--auth-token") {
      parsed.authToken = readValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--viewer-token") {
      parsed.viewerToken = readValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--operator-token") {
      parsed.operatorToken = readValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--admin-token") {
      parsed.adminToken = readValue(argv, ++index, arg);
      continue;
    }
    if (arg === "--confirm-token" || arg === "--mutation-confirm-token") {
      parsed.mutationConfirmToken = readValue(argv, ++index, arg);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

export function adminCliHelp(): string {
  return [
    "Usage: graphvault-studio --dir <storage-directory> [options]",
    "",
    "Options:",
    "  --dir, --storage-directory <path>      Storage directory to inspect.",
    "  --host <host>                         Host to bind. Defaults to 127.0.0.1.",
    "  --port <port>                         Port to bind. Defaults to 4177.",
    "  --token, --auth-token <token>         Bearer token for UI/API access.",
    "  --viewer-token <token>                Read-only bearer token.",
    "  --operator-token <token>              Maintenance and backup bearer token.",
    "  --admin-token <token>                 Full mutation bearer token.",
    "  --confirm-token <token>               Token required to commit mutations.",
    "  --allow-mutations                     Enable maintenance and data mutation APIs.",
    "  --doctor                              Inspect the store and exit without starting the web server.",
    "  --json                                Print doctor output as JSON.",
    "  -h, --help                            Show this help.",
    "",
    "Environment:",
    "  GRAPHVAULT_ADMIN_TOKEN                Default bearer token.",
    "  GRAPHVAULT_VIEWER_TOKEN               Read-only bearer token.",
    "  GRAPHVAULT_OPERATOR_TOKEN             Maintenance and backup bearer token.",
    "  GRAPHVAULT_ADMIN_ROLE_TOKEN           Full mutation bearer token.",
    "  GRAPHVAULT_ADMIN_CONFIRM_TOKEN        Default mutation confirmation token.",
  ].join("\n");
}

async function main(argv: readonly string[]): Promise<void> {
  const options = parseAdminCliArgs(argv);
  if (options.help) {
    console.log(adminCliHelp());
    return;
  }
  if (!options.storageDirectory) {
    throw new Error("Missing required --dir <storage-directory> option.");
  }

  const serverOptions = {
    storageDirectory: options.storageDirectory,
    host: options.host,
    port: options.port,
    allowMutations: options.allowMutations,
  };
  if (options.doctor) {
    const result = await runDoctor(serverOptions, options.json);
    if (!result.ok) {
      process.exitCode = 2;
    }
    return;
  }
  const running = await startAdminServer({
    ...serverOptions,
    ...(options.authToken ? { authToken: options.authToken } : {}),
    ...(accessTokensFromOptions(options).length ? { accessTokens: accessTokensFromOptions(options) } : {}),
    ...(options.mutationConfirmToken ? { mutationConfirmToken: options.mutationConfirmToken } : {}),
  });

  console.log(`GraphVault Studio: ${running.url}`);
  console.log(`Storage directory: ${options.storageDirectory}`);
  console.log(`Mutations: ${options.allowMutations ? "enabled" : "disabled"}`);
  if (options.authToken || accessTokensFromOptions(options).length) {
    console.log("Auth: bearer token required");
  }
  if (options.mutationConfirmToken) {
    console.log("Mutation confirmation: required");
  }

  let closing = false;
  const close = (): void => {
    if (closing) {
      return;
    }
    closing = true;
    void running.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

export interface AdminDoctorResult {
  ok: boolean;
  status: "ok" | "warning" | "unsafe" | "error";
  summary: AdminSummary;
}

export async function runDoctor(
  options: StorageAdminClientOptions,
  json = false,
  write: (output: string) => void = console.log,
): Promise<AdminDoctorResult> {
  const client = new StorageAdminClient(options);
  const summary = await client.summary();
  const verificationOk = summary.verification?.ok === true;
  const safetyStatus = summary.productionSafety.status;
  const ok = verificationOk && safetyStatus !== "unsafe";
  const status: AdminDoctorResult["status"] = ok
    ? safetyStatus === "warning"
      ? "warning"
      : "ok"
    : safetyStatus === "unsafe"
      ? "unsafe"
      : "error";
  const result = { ok, status, summary };
  if (json) {
    write(JSON.stringify(result, null, 2));
  } else {
    write(formatDoctorResult(result));
  }
  return result;
}

export function formatDoctorResult(result: AdminDoctorResult): string {
  const { summary } = result;
  const lines = [
    `GraphVault Studio Doctor: ${result.status}`,
    `Storage directory: ${summary.storageDirectory}`,
    `Objects: ${summary.objectCount}`,
    `Transaction: ${summary.transactionId}`,
    `Verification: ${summary.verification?.ok ? "ok" : "failed"}`,
    `Operations: ${summary.operations.status}`,
    `Production safety: ${summary.productionSafety.status} (${summary.productionSafety.score})`,
  ];
  for (const issue of summary.productionSafety.issues) {
    lines.push(`- ${issue.severity}: ${issue.code} - ${issue.message}`);
  }
  if (summary.verification?.errors.length) {
    for (const error of summary.verification.errors) {
      lines.push(`- error: ${error}`);
    }
  }
  return lines.join("\n");
}

function accessTokensFromOptions(options: ParsedAdminCliArgs): Array<{ token: string; role: "viewer" | "operator" | "admin" }> {
  return [
    ...(options.viewerToken ? [{ token: options.viewerToken, role: "viewer" as const }] : []),
    ...(options.operatorToken ? [{ token: options.operatorToken, role: "operator" as const }] : []),
    ...(options.adminToken ? [{ token: options.adminToken, role: "admin" as const }] : []),
  ];
}

function readValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function isCliEntryPoint(moduleUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }
  const modulePath = fileURLToPath(moduleUrl);
  try {
    return realpathSync(argvPath) === realpathSync(modulePath);
  } catch {
    return argvPath === modulePath;
  }
}

if (isCliEntryPoint(import.meta.url, process.argv[1])) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(adminCliHelp());
    process.exit(1);
  });
}
