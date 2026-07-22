#!/usr/bin/env node

/**
 * Read-only MCP adapter for Outline.
 *
 * Continue starts this process over stdio. The adapter exposes safe read tools
 * and calls Outline's authenticated JSON API. It intentionally contains no
 * create, update, archive, or delete operations.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_NAME = "outline-regulatory-readonly";
const SERVER_VERSION = "0.1.0";
const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_TOKEN_FILE = path.join(HERE, "outline-token.txt");
const MAX_DOCUMENT_CHARS = Number.parseInt(
  process.env.OUTLINE_MAX_DOCUMENT_CHARS || "12000",
  10,
);

function getBaseUrl() {
  return (process.env.OUTLINE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getToken() {
  const environmentToken = process.env.OUTLINE_API_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  const tokenFile = process.env.OUTLINE_TOKEN_FILE || DEFAULT_TOKEN_FILE;
  try {
    const token = fs.readFileSync(tokenFile, "utf8").trim();
    if (token) return token;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(`Unable to read Outline token file: ${error.message}`);
    }
  }

  throw new Error(
    `Outline API token is missing. Run Set-OutlineToken.ps1 or create ${tokenFile}.`,
  );
}

async function outlineApi(method, payload = {}) {
  const response = await fetch(`${getBaseUrl()}/api/${method}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      "User-Agent": `${SERVER_NAME}/${SERVER_VERSION}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { error: raw || response.statusText };
  }

  if (!response.ok || body.ok === false) {
    const detail = body.error || body.message || response.statusText;
    throw new Error(`Outline ${method} failed (${response.status}): ${detail}`);
  }

  return body;
}

function boundedInteger(value, fallback, minimum = 1, maximum = 20) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function trimText(value, maximum) {
  const text = typeof value === "string" ? value : "";
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum)}\n\n[Content truncated by the MCP adapter]`;
}

function focusedDocumentContent(text, query, maximum) {
  const source = typeof text === "string" ? text : "";
  const safeMaximum = Math.max(2000, Math.min(MAX_DOCUMENT_CHARS, maximum));
  const phrase = String(query || "").trim().toLowerCase();

  if (!phrase) {
    return {
      content: trimText(source, safeMaximum),
      focused: false,
      truncated: source.length > safeMaximum,
    };
  }

  const lower = source.toLowerCase();
  const searchTerms = [
    phrase,
    ...phrase.split(/\s+/).filter((term) => term.length >= 5),
  ];
  const queryTerms = [...new Set(phrase.split(/\s+/).filter((term) => term.length >= 4))];
  const positions = [];

  for (const term of searchTerms) {
    let from = 0;
    let foundForTerm = 0;
    while (foundForTerm < 10) {
      const position = lower.indexOf(term, from);
      if (position === -1) break;
      if (!positions.some((existing) => Math.abs(existing - position) < 500)) {
        positions.push(position);
        foundForTerm += 1;
      }
      from = position + Math.max(1, term.length);
    }
  }

  if (!positions.length) {
    return {
      content: trimText(source, safeMaximum),
      focused: false,
      truncated: source.length > safeMaximum,
      note: "The query was not found verbatim; returning the beginning of the document.",
    };
  }

  const substantivePositions = positions.filter((position) => {
    const pageStart = source.lastIndexOf("\n## PDF page ", position);
    const nextPage = source.indexOf("\n## PDF page ", position + 1);
    const pageEnd = nextPage === -1 ? source.length : nextPage;
    const pageText = source.slice(Math.max(0, pageStart), pageEnd);
    return !/table of contents|\.{10,}/i.test(pageText);
  });
  const selectedPositions = substantivePositions.length
    ? substantivePositions
    : positions;

  const scorePosition = (position) => {
    const after = lower.slice(position, position + 1400);
    const pageStart = source.lastIndexOf("\n## PDF page ", position);
    const nextPage = source.indexOf("\n## PDF page ", position + 1);
    const pageEnd = nextPage === -1 ? source.length : nextPage;
    const pageLower = lower.slice(Math.max(0, pageStart), pageEnd);
    let score = queryTerms.filter((term) => pageLower.includes(term)).length * 20;
    if (pageLower.includes(phrase)) score += 100;
    if (/software requirements specification\s*\(srs\)\s*\n+\s*the srs documents/.test(after)) {
      score += 100;
    }
    if (/the srs documents/.test(after)) score += 40;
    if (/should include|we recommend|typically specifies/.test(after)) score += 20;
    return score;
  };

  selectedPositions.sort(
    (left, right) => scorePosition(right) - scorePosition(left) || left - right,
  );

  const passages = [];
  let used = 0;
  for (const position of selectedPositions) {
    let start = Math.max(0, position - 900);
    const pageHeading = source.lastIndexOf("\n## PDF page ", position);
    if (pageHeading >= 0 && pageHeading >= start - 1200) {
      start = pageHeading + 1;
    }
    const end = Math.min(source.length, position + 1800);
    const passage = source.slice(start, end).trim();
    if (!passage) continue;
    const remaining = safeMaximum - used;
    if (remaining <= 0) break;
    if (passage.length > remaining) {
      if (!passages.length) passages.push(passage.slice(0, remaining));
      break;
    }
    passages.push(passage);
    used += passage.length;
  }

  return {
    content: passages.join("\n\n--- NEXT MATCH ---\n\n"),
    focused: true,
    truncated: true,
    matchCount: passages.length,
  };
}

function absoluteDocumentUrl(document) {
  const candidate = document?.url || document?.urlId;
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  return `${getBaseUrl()}${candidate.startsWith("/") ? "" : "/"}${candidate}`;
}

function documentSummary(document, context = "", includeExcerpt = true) {
  const summary = {
    id: document?.id || document?.urlId || null,
    title: document?.title || "Untitled",
    url: absoluteDocumentUrl(document),
    collectionId: document?.collectionId || null,
    updatedAt: document?.updatedAt || null,
  };
  if (includeExcerpt) {
    summary.excerpt = trimText(context || document?.text || "", 1500);
  }
  return summary;
}

const TOOLS = [
  {
    name: "outline_research",
    description:
      "Use this single read-only tool for regulatory questions. It searches Outline, opens the best matching document, and returns compact passages with nearby PDF page markers.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The exact regulatory topic or question to research",
        },
        max_chars: {
          type: "integer",
          minimum: 1500,
          maximum: 5000,
          default: 3500,
          description: "Maximum characters of focused evidence to return",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "outline_list_sources",
    description: "List available Outline collections and document titles without loading document bodies.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

async function callTool(name, args = {}) {
  if (name === "outline_research") {
    const query = String(args.query || "").trim();
    if (!query) throw new Error("query is required");

    const search = await outlineApi("documents.search", {
      query,
      limit: 3,
      offset: 0,
      statusFilter: ["published"],
      snippetMinWords: 30,
      snippetMaxWords: 80,
    });
    const matches = search.data || [];
    if (!matches.length) {
      return {
        query,
        found: false,
        message: "No matching approved Outline document was found.",
      };
    }

    const bestMatch = matches[0];
    const bestDocument = bestMatch.document || bestMatch;
    const documentId = bestDocument.id || bestDocument.urlId;
    if (!documentId) throw new Error("The best search result did not include a document ID");

    const detail = await outlineApi("documents.info", { id: documentId });
    const document = detail.data || bestDocument;
    const focused = focusedDocumentContent(
      document.text || "",
      query,
      boundedInteger(args.max_chars, 3500, 1500, 5000),
    );

    return {
      query,
      found: true,
      source: {
        id: document.id || documentId,
        title: document.title || "Untitled",
        url: absoluteDocumentUrl(document),
        updatedAt: document.updatedAt || null,
      },
      evidence: focused.content,
      evidenceFocused: focused.focused,
      evidenceTruncated: focused.truncated,
      alternativeSources: matches.slice(1).map((match) => {
        const alternative = match.document || match;
        return {
          id: alternative.id || alternative.urlId || null,
          title: alternative.title || "Untitled",
          url: absoluteDocumentUrl(alternative),
        };
      }),
      citationInstruction:
        "Answer only from evidence. Cite the source title and any 'PDF page' marker present. If evidence is insufficient, say so.",
    };
  }

  if (name === "outline_list_sources") {
    const [collections, documents] = await Promise.all([
      outlineApi("collections.list", { limit: 20, offset: 0 }),
      outlineApi("documents.list", {
        limit: 20,
        offset: 0,
        status: "published",
        sort: "title",
        direction: "ASC",
      }),
    ]);
    return {
      collections: (collections.data || []).map((item) => ({
        id: item.id,
        name: item.name,
      })),
      documents: (documents.data || []).map((item) => ({
        id: item.id || item.urlId || null,
        title: item.title || "Untitled",
        collectionId: item.collectionId || null,
      })),
    };
  }

  if (name === "outline_search") {
    const query = String(args.query || "").trim();
    if (!query) throw new Error("query is required");

    const payload = {
      query,
      limit: boundedInteger(args.limit, 5),
      offset: 0,
      statusFilter: ["published"],
    };
    if (args.collection_id) payload.collectionId = String(args.collection_id);

    const response = await outlineApi("documents.search", payload);
    const results = (response.data || []).map((result) =>
      documentSummary(result.document || result, result.context || ""),
    );
    return {
      query,
      resultCount: results.length,
      results,
      citationInstruction:
        "Cite the document title and URL/ID returned here; open the document before making detailed claims.",
    };
  }

  if (name === "outline_get_document") {
    const id = String(args.id || "").trim();
    if (!id) throw new Error("id is required");

    const response = await outlineApi("documents.info", { id });
    const document = response.data || {};
    const focused = focusedDocumentContent(
      document.text || "",
      args.query,
      boundedInteger(args.max_chars, 8000, 2000, 12000),
    );
    return {
      id: document.id || id,
      title: document.title || "Untitled",
      url: absoluteDocumentUrl(document),
      collectionId: document.collectionId || null,
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
      query: args.query || null,
      focused: focused.focused,
      contentTruncated: focused.truncated,
      matchCount: focused.matchCount || 0,
      note: focused.note || null,
      content: focused.content,
    };
  }

  if (name === "outline_list_collections") {
    const payload = {
      limit: boundedInteger(args.limit, 20),
      offset: 0,
      sort: "name",
      direction: "ASC",
    };
    if (args.query) payload.query = String(args.query);

    const response = await outlineApi("collections.list", payload);
    return {
      collections: (response.data || []).map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: trimText(collection.description || "", 1000),
        url: collection.url
          ? `${getBaseUrl()}${collection.url.startsWith("/") ? "" : "/"}${collection.url}`
          : null,
      })),
    };
  }

  if (name === "outline_list_documents") {
    const payload = {
      limit: boundedInteger(args.limit, 20),
      offset: 0,
      sort: "title",
      direction: "ASC",
      status: "published",
    };
    if (args.collection_id) payload.collectionId = String(args.collection_id);

    const response = await outlineApi("documents.list", payload);
    return {
      documents: (response.data || []).map((document) =>
        documentSummary(document, "", false),
      ),
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function success(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function failure(id, code, message, data) {
  writeMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  });
}

async function handleMessage(message) {
  const { id, method, params = {} } = message;

  if (method === "initialize") {
    success(id, {
      protocolVersion: params.protocolVersion || "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "Read-only access to approved Outline sources. For a regulatory question, call outline_research exactly once and answer only from its compact evidence.",
    });
    return;
  }

  if (method === "ping") {
    success(id, {});
    return;
  }

  if (method === "tools/list") {
    success(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    try {
      const result = await callTool(params.name, params.arguments || {});
      success(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      });
    } catch (error) {
      success(id, {
        content: [{ type: "text", text: error.message }],
        isError: true,
      });
    }
    return;
  }

  if (typeof id !== "undefined") {
    failure(id, -32601, `Method not found: ${method}`);
  }
}

async function runCheck() {
  const auth = await outlineApi("auth.info", {});
  const collections = await outlineApi("collections.list", {
    limit: 20,
    offset: 0,
  });
  const documents = await outlineApi("documents.list", {
    limit: 20,
    offset: 0,
    status: "published",
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        outlineBaseUrl: getBaseUrl(),
        authenticated: Boolean(auth.data),
        collections: (collections.data || []).map((item) => item.name),
        documents: (documents.data || []).map((item) => item.title),
      },
      null,
      2,
    ),
  );
}

async function runStdio() {
  process.stdin.setEncoding("utf8");
  let buffer = "";

  for await (const chunk of process.stdin) {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        failure(null, -32700, "Parse error", error.message);
        continue;
      }

      try {
        await handleMessage(message);
      } catch (error) {
        if (typeof message.id !== "undefined") {
          failure(message.id, -32603, "Internal error", error.message);
        }
      }
    }
  }
}

if (process.argv.includes("--check")) {
  runCheck().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else {
  runStdio().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
