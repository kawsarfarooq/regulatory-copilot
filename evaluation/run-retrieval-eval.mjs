#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CASES_PATH = path.join(HERE, "cases.json");
const SERVER_PATH = path.join(ROOT, "outline-mcp", "outline_mcp_server.mjs");
const RESULTS_DIR = path.join(HERE, "results");

function callResearch(testCase, index) {
  const request = {
    jsonrpc: "2.0",
    id: index + 1,
    method: "tools/call",
    params: {
      name: "outline_research",
      arguments: { query: testCase.query, max_chars: 3500 },
    },
  };

  const run = spawnSync(process.execPath, [SERVER_PATH], {
    input: `${JSON.stringify(request)}\n`,
    encoding: "utf8",
    env: process.env,
    timeout: 30000,
  });

  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(run.stderr || `MCP exited ${run.status}`);

  const line = run.stdout.trim().split(/\r?\n/).find(Boolean);
  if (!line) throw new Error("MCP produced no response");
  const rpc = JSON.parse(line);
  if (rpc.error) throw new Error(rpc.error.message);
  if (rpc.result?.isError) throw new Error(rpc.result.content?.[0]?.text || "Tool error");
  return JSON.parse(rpc.result.content[0].text);
}

function evaluate(testCase, payload) {
  const evidence = String(payload.evidence || "");
  const markers = [...evidence.matchAll(/PDF page \d+/g)].map((match) => match[0]);
  const uniqueMarkers = [...new Set(markers)];
  const checks = {
    found: payload.found === true,
    title: payload.source?.title === testCase.expectedTitle,
    page: testCase.expectedPage ? uniqueMarkers.includes(testCase.expectedPage) : uniqueMarkers.length > 0,
    noTableOfContents: !/table of contents|\.{10,}/i.test(evidence),
    boundedEvidence: evidence.length > 0 && evidence.length <= 3500,
  };
  return {
    id: testCase.id,
    query: testCase.query,
    expectedTitle: testCase.expectedTitle,
    expectedPage: testCase.expectedPage || null,
    actualTitle: payload.source?.title || null,
    pageMarkers: uniqueMarkers,
    evidenceCharacters: evidence.length,
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

function renderMarkdown(report) {
  const rows = report.results.map((result) =>
    `| ${result.id} | ${result.actualTitle || "—"} | ${result.pageMarkers.join(", ") || "—"} | ${result.evidenceCharacters} | ${result.passed ? "PASS" : "FAIL"} |`,
  );
  return [
    "# Retrieval evaluation",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Result: **${report.passedCount}/${report.total} passed**`,
    "",
    "| Case | Retrieved source | Page markers | Evidence chars | Status |",
    "| --- | --- | --- | ---: | --- |",
    ...rows,
    "",
    "Checks: source selection, expected/page-marker presence, table-of-contents exclusion, and evidence-size bound.",
    "",
  ].join("\n");
}

const cases = JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));
const results = cases.map((testCase, index) => evaluate(testCase, callResearch(testCase, index)));
const report = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  passedCount: results.filter((result) => result.passed).length,
  results,
};

fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.writeFileSync(path.join(RESULTS_DIR, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(RESULTS_DIR, "latest.md"), renderMarkdown(report));
console.log(renderMarkdown(report));
process.exitCode = report.passedCount === report.total ? 0 : 1;
