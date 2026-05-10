import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { StorageAdminClient, type StorageAdminClientOptions } from "./admin-client.js";
import { ADMIN_HTML } from "./admin-ui.js";

export interface AdminServerOptions extends StorageAdminClientOptions {
  host?: string;
  port?: number;
  authToken?: string;
  mutationConfirmToken?: string;
}

export interface RunningAdminServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export async function startAdminServer(options: AdminServerOptions): Promise<RunningAdminServer> {
  const client = new StorageAdminClient(options);
  const server = createServer((request, response) => {
    void route(client, options, request, response).catch((error) => sendJson(response, 500, { error: String(error?.message ?? error) }));
  });
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function route(client: StorageAdminClient, options: AdminServerOptions, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      ADMIN_HTML.replace("__CONFIRM_REQUIRED__", options.mutationConfirmToken ? "true" : "false").replace(
        "__AUTH_REQUIRED__",
        options.authToken ? "true" : "false",
      ),
    );
    return;
  }
  if (request.method === "GET" && (url.pathname === "/assets/graphvault-logo.png" || url.pathname === "/favicon.ico")) {
    const logo = await readFile(new URL("../assets/graphvault-logo.png", import.meta.url));
    response.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=86400" });
    response.end(logo);
    return;
  }
  if (options.authToken && !isAuthorized(request, options.authToken)) {
    return sendJson(response, 401, { error: "Unauthorized" });
  }
  if (request.method === "GET" && url.pathname === "/api/summary") {
    return sendJson(response, 200, await client.summary({ verify: url.searchParams.get("verify") !== "false" }));
  }
  if (request.method === "GET" && url.pathname === "/api/root") {
    return sendJson(response, 200, await client.rootReference());
  }
  if (request.method === "GET" && url.pathname === "/api/object-page") {
    return sendJson(response, 200, await client.listObjectPage({ offset: numberParam(url, "offset", 0), limit: numberParam(url, "limit", 100) }));
  }
  if (request.method === "GET" && url.pathname === "/api/objects") {
    return sendJson(response, 200, await client.listObjects());
  }
  if (request.method === "GET" && url.pathname?.startsWith("/api/objects/") && url.pathname.endsWith("/children")) {
    const objectId = decodeURIComponent(url.pathname.slice("/api/objects/".length, -"/children".length));
    return sendJson(response, 200, await client.listObjectChildren(objectId));
  }
  if (request.method === "GET" && url.pathname?.startsWith("/api/objects/") && url.pathname.endsWith("/path")) {
    const objectId = decodeURIComponent(url.pathname.slice("/api/objects/".length, -"/path".length));
    return sendJson(response, 200, await client.hierarchyPath(objectId));
  }
  if (request.method === "GET" && url.pathname?.startsWith("/api/objects/")) {
    return sendJson(response, 200, await client.getObject(decodeURIComponent(url.pathname.slice("/api/objects/".length))));
  }
  if (request.method === "GET" && url.pathname === "/api/graph") {
    return sendJson(response, 200, await client.graph());
  }
  if (request.method === "GET" && url.pathname === "/api/search") {
    return sendJson(response, 200, await client.search(url.searchParams.get("q") ?? "", { limit: numberParam(url, "limit", 500) }));
  }
  if (request.method === "GET" && url.pathname === "/api/types") {
    return sendJson(response, 200, (await client.readTypeDictionary()) ?? null);
  }
  if (request.method === "GET" && url.pathname === "/api/transactions") {
    return sendJson(response, 200, await client.listTransactions());
  }
  if (request.method === "GET" && url.pathname === "/api/journal") {
    return sendText(response, 200, await client.readJournal());
  }
  if (request.method === "GET" && url.pathname === "/api/verify") {
    return sendJson(response, 200, await client.verify());
  }
  if (request.method === "POST" && url.pathname === "/api/maintenance") {
    return sendJson(response, 200, await client.maintain(await readJson(request)));
  }
  if (request.method === "POST" && url.pathname === "/api/backup") {
    return sendJson(response, 200, await client.backup(await readJson(request)));
  }
  if (request.method === "POST" && url.pathname === "/api/preview-mutation") {
    return sendJson(response, 200, await client.previewMutation(await readJson(request)));
  }
  if (request.method === "POST" && url.pathname === "/api/gvql") {
    const body = await readJson(request);
    if (body?.dryRun !== true && options.mutationConfirmToken && body?.confirmToken !== options.mutationConfirmToken) {
      return sendJson(response, 403, { error: "GVQL mutation confirmation token is missing or invalid." });
    }
    return sendJson(response, 200, await client.gvql(String(body?.query ?? ""), { parameters: body?.parameters ?? {}, dryRun: body?.dryRun === true }));
  }
  if (request.method === "POST" && url.pathname === "/api/mutate") {
    const body = await readJson(request);
    if (options.mutationConfirmToken && body?.confirmToken !== options.mutationConfirmToken) {
      return sendJson(response, 403, { error: "Mutation confirmation token is missing or invalid." });
    }
    return sendJson(response, 200, await client.mutate(body));
  }
  sendJson(response, 404, { error: "Not found" });
}

function numberParam(url: URL, name: string, fallback: number): number {
  const value = Number(url.searchParams.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function isAuthorized(request: IncomingMessage, authToken: string): boolean {
  return request.headers.authorization === `Bearer ${authToken}`;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value, null, 2));
}

function sendText(response: ServerResponse, status: number, value: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(value);
}

async function readJson(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8").trim();
  return body ? JSON.parse(body) : {};
}
