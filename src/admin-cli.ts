#!/usr/bin/env node
import { startAdminServer } from "./admin-server.js";

export interface ParsedAdminCliArgs {
  storageDirectory?: string;
  host: string;
  port: number;
  allowMutations: boolean;
  authToken?: string;
  mutationConfirmToken?: string;
  help: boolean;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4177;

export function parseAdminCliArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): ParsedAdminCliArgs {
  const parsed: ParsedAdminCliArgs = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    allowMutations: false,
    help: false,
  };
  if (env["GRAPHVAULT_ADMIN_TOKEN"]) {
    parsed.authToken = env["GRAPHVAULT_ADMIN_TOKEN"];
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
    "Usage: graphvault-admin --dir <storage-directory> [options]",
    "",
    "Options:",
    "  --dir, --storage-directory <path>      Storage directory to inspect.",
    "  --host <host>                         Host to bind. Defaults to 127.0.0.1.",
    "  --port <port>                         Port to bind. Defaults to 4177.",
    "  --token, --auth-token <token>         Bearer token for UI/API access.",
    "  --confirm-token <token>               Token required to commit mutations.",
    "  --allow-mutations                     Enable maintenance and data mutation APIs.",
    "  -h, --help                            Show this help.",
    "",
    "Environment:",
    "  GRAPHVAULT_ADMIN_TOKEN                Default bearer token.",
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
  const running = await startAdminServer({
    ...serverOptions,
    ...(options.authToken ? { authToken: options.authToken } : {}),
    ...(options.mutationConfirmToken ? { mutationConfirmToken: options.mutationConfirmToken } : {}),
  });

  console.log(`GraphVault Studio: ${running.url}`);
  console.log(`Storage directory: ${options.storageDirectory}`);
  console.log(`Mutations: ${options.allowMutations ? "enabled" : "disabled"}`);
  if (options.authToken) {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(adminCliHelp());
    process.exit(1);
  });
}
