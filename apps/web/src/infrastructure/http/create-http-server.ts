import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AppError, NotFoundError, ValidationError } from "../../domain/errors";
import type { ConversationUseCase } from "../../application/conversation.usecase";
import type { HandleSurfaceActionUseCase } from "../../application/handle-surface-action.usecase";
import type { RunConversationUseCase } from "../../application/run-conversation.usecase";
import type { TaskUseCase } from "../../application/task.usecase";
import {
  createEventEncoder,
  encodeRunEvent,
  extractSurfaceAction,
  lastUserText,
} from "./ag-ui-sse-transport";

export interface HttpServerDeps {
  conversations: ConversationUseCase;
  tasks: TaskUseCase;
  runConversation: RunConversationUseCase;
  handleSurfaceAction: HandleSurfaceActionUseCase;
}

export function startHttpServer(deps: HttpServerDeps, port: number) {
  const server = createServer((req, res) => {
    void handleRequest(req, res, deps);
  });
  server.listen(port);
  return server;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HttpServerDeps,
): Promise<void> {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && (url.pathname === "/agent" || url.pathname === "/")) {
      await handleAgent(req, res, deps);
      return;
    }

    const deviceId = requireDeviceId(req);
    await handleRest(req, res, url, deviceId, deps);
  } catch (err) {
    writeError(res, err);
  }
}

async function handleRest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deviceId: string,
  deps: HttpServerDeps,
): Promise<void> {
  const { conversations, tasks } = deps;
  const path = url.pathname;

  if (req.method === "GET" && path === "/session") {
    json(res, 200, await conversations.ensureSession(deviceId));
    return;
  }

  if (req.method === "GET" && path === "/conversations") {
    json(res, 200, { conversations: await conversations.list(deviceId) });
    return;
  }

  if (req.method === "POST" && path === "/conversations") {
    const body = (await readJson(req)) as { title?: string };
    json(res, 201, { conversation: await conversations.create(deviceId, body.title) });
    return;
  }

  const conversationMatch = path.match(/^\/conversations\/([^/]+)$/);
  if (conversationMatch && req.method === "GET") {
    json(res, 200, {
      conversationId: conversationMatch[1],
      messages: await conversations.history(deviceId, conversationMatch[1]),
    });
    return;
  }
  if (conversationMatch && req.method === "PATCH") {
    const body = (await readJson(req)) as { title?: string };
    json(res, 200, {
      conversation: await conversations.rename(deviceId, conversationMatch[1], body.title ?? ""),
    });
    return;
  }
  if (conversationMatch && req.method === "DELETE") {
    await conversations.remove(deviceId, conversationMatch[1]);
    json(res, 200, { ok: true });
    return;
  }

  const archivedMatch = path.match(/^\/conversations\/([^/]+)\/archived$/);
  if (archivedMatch && req.method === "GET") {
    json(res, 200, {
      conversationId: archivedMatch[1],
      messages: await conversations.archivedForDevice(deviceId, archivedMatch[1]),
    });
    return;
  }

  if (req.method === "GET" && path === "/tasks") {
    json(res, 200, { tasks: await tasks.list(deviceId) });
    return;
  }

  if (req.method === "GET" && path === "/tasks/alerts") {
    const sinceRaw = url.searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : undefined;
    if (since && Number.isNaN(since.getTime())) {
      throw new ValidationError("since must be an ISO date");
    }
    json(res, 200, { results: await tasks.alerts(deviceId, since) });
    return;
  }

  if (req.method === "POST" && path === "/tasks") {
    const body = (await readJson(req)) as {
      cronExpression?: string;
      prompt?: string;
      conversationId?: string;
    };
    json(res, 201, {
      task: await tasks.create(
        deviceId,
        body.cronExpression ?? "",
        body.prompt ?? "",
        body.conversationId,
      ),
    });
    return;
  }

  const toggleMatch = path.match(/^\/tasks\/([^/]+)\/toggle$/);
  if (toggleMatch && req.method === "POST") {
    json(res, 200, { task: await tasks.toggle(deviceId, toggleMatch[1]) });
    return;
  }

  const runsMatch = path.match(/^\/tasks\/([^/]+)\/runs$/);
  if (runsMatch && req.method === "GET") {
    json(res, 200, { runs: await tasks.runs(deviceId, runsMatch[1]) });
    return;
  }

  const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === "DELETE") {
    await tasks.remove(deviceId, taskMatch[1]);
    json(res, 200, { ok: true });
    return;
  }

  throw new NotFoundError("Route");
}

async function handleAgent(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HttpServerDeps,
): Promise<void> {
  const accept = header(req, "accept");
  const encoder = createEventEncoder(accept);
  const body = await readJson(req);
  const input = body as {
    threadId?: string;
    runId?: string;
    messages?: Array<{ role?: string; content?: unknown }>;
    forwardedProps?: unknown;
  };

  const threadId = typeof input.threadId === "string" ? input.threadId : "";
  const runId = typeof input.runId === "string" && input.runId ? input.runId : crypto.randomUUID();
  if (!threadId) {
    throw new ValidationError("threadId is required");
  }

  const deviceId = header(req, "x-device-id") ?? "anonymous";
  const officialInput = {
    threadId,
    runId,
    messages: Array.isArray(input.messages) ? input.messages : [],
    forwardedProps: input.forwardedProps,
  } as Parameters<typeof extractSurfaceAction>[0];

  const action = extractSurfaceAction(officialInput);
  const content = lastUserText(officialInput);
  await deps.conversations.ensureForThread(deviceId, threadId, content?.slice(0, 50));

  res.writeHead(200, {
    "Content-Type": encoder.getContentType(),
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const write = (event: Parameters<typeof encodeRunEvent>[1]) => {
    res.write(encodeRunEvent(encoder, event));
  };

  try {
    if (action) {
      await deps.handleSurfaceAction.execute(
        { conversationId: threadId, action, runId },
        write,
      );
    } else {
      await deps.runConversation.execute(
        { conversationId: threadId, content, runId },
        write,
      );
    }
  } catch (err) {
    res.write(
      encodeRunEvent(encoder, {
        kind: "run-failed",
        runId,
        message: err instanceof Error ? err.message : "Agent run failed",
      }),
    );
  } finally {
    res.end();
  }
}

function applyCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, X-Device-Id",
  );
}

function requireDeviceId(req: IncomingMessage): string {
  const deviceId = header(req, "x-device-id");
  if (!deviceId) {
    throw new ValidationError("X-Device-Id is required");
  }
  return deviceId;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]) return value[0].trim();
  return undefined;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function writeError(res: ServerResponse, err: unknown) {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof ValidationError) {
    json(res, 400, { code: err.code, message: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    json(res, 404, { code: err.code, message: err.message });
    return;
  }
  if (err instanceof AppError) {
    json(res, 400, { code: err.code, message: err.message });
    return;
  }
  json(res, 500, {
    code: "INTERNAL_ERROR",
    message: err instanceof Error ? err.message : "Internal error",
  });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}
