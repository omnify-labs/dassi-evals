#!/usr/bin/env node
/**
 * Merge sharded Dassi benchmark runs into one result set.
 *
 *   node scripts/aggregate.mjs --dataset odysseys --shards <dir> --tasks <odysseys.json> --out odysseys
 *   node scripts/aggregate.mjs --dataset om2w     --shards <dir> --tasks <Online_Mind2Web.json> --out om2w
 *
 * --tasks is the upstream dataset file at the revision the run was pinned to.
 * <dir> holds one extracted CI archive per shard (any depth); every
 * `run-state.json` under it is one shard. The full task list is the
 * denominator: a task no shard reported is scored as a failure, never dropped.
 *
 * Writes <out>/results.json, <out>/tasks.csv and one <out>/results/<task_id>/
 * folder per task: result.json (task, final answer, action history),
 * session.json (every model turn, tool call, tool output and token usage) and
 * verdict.json (status and the judge's decision). Screenshots and the
 * extension's internal service-worker logs are not copied.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    dataset: { type: 'string' },
    shards: { type: 'string' },
    tasks: { type: 'string' },
    out: { type: 'string' },
  },
});
for (const k of ['dataset', 'shards', 'tasks', 'out']) {
  if (!args[k]) throw new Error(`--${k} is required`);
}
if (!['odysseys', 'om2w'].includes(args.dataset)) throw new Error(`unknown --dataset ${args.dataset}`);

/** Both upstream datasets are a JSON array of { task_id, level, website, ... }. */
function loadTasks(path) {
  return JSON.parse(readFileSync(path, 'utf8')).map((r) => ({ id: r.task_id, level: r.level, website: r.website }));
}

function findRunStates(root) {
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (name === 'run-state.json') found.push(full);
      else if (statSync(full).isDirectory() && !name.startsWith('task')) walk(full);
    }
  };
  walk(root);
  return found.sort();
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

/** Cost, model calls, input tokens and tool calls (by tool name) from a task's exported session. */
function sessionStats(taskDir) {
  const evidence = readJson(join(taskDir, 'session-evidence.json'));
  if (!evidence) return {};
  const usage = evidence.usage ?? [];
  const toolNames = (evidence.messages ?? [])
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((block) => block.type === 'tool-call')
    .map((block) => block.toolName);
  return {
    costUsd: usage.reduce((sum, u) => sum + (u.usage?.cost?.total ?? 0), 0),
    llmCalls: usage.length,
    inputTokens: usage.reduce((sum, u) => sum + (u.usage?.input ?? 0) + (u.usage?.cacheRead ?? 0), 0),
    toolCalls: toolNames.length,
    toolNames,
  };
}

const tasks = loadTasks(args.tasks);
const taskById = new Map(tasks.map((t) => [t.id, t]));
const runStates = findRunStates(args.shards);
if (runStates.length === 0) throw new Error(`no run-state.json under ${args.shards}`);

const identities = new Set();
const rows = new Map();
const shards = [];
for (const path of runStates) {
  const resultsDir = dirname(path);
  const state = JSON.parse(readFileSync(path, 'utf8'));
  identities.add(
    JSON.stringify({
      model: state.model,
      judgeModel: state.judgeModel,
      judgeProvider: state.judgeProvider,
      officialJudgeVersion: state.officialJudgeVersion,
    }),
  );
  shards.push({ runState: path.slice(args.shards.length + 1), tasks: state.results.length, startedAt: state.startedAt });
  for (const r of state.results) {
    if (!taskById.has(r.taskId)) throw new Error(`${path}: task ${r.taskId} is not in the dataset`);
    if (rows.has(r.taskId)) throw new Error(`task ${r.taskId} appears in two shards — remove the superseded shard`);
    rows.set(r.taskId, { ...r, taskDir: join(resultsDir, `task${r.taskId}`), ...sessionStats(join(resultsDir, `task${r.taskId}`)) });
  }
}
if (identities.size !== 1) {
  throw new Error(`shards disagree on agent/judge identity:\n${[...identities].join('\n')}`);
}
const identity = JSON.parse([...identities][0]);

/** OM2W is scored by the trajectory WebJudge; Odysseys by the rubric judge (success = every rubric passed). */
const verdictField = args.dataset === 'om2w' ? 'judgedOfficial' : 'judged';

const perTask = tasks.map((t) => {
  const row = rows.get(t.id);
  return {
    task_id: t.id,
    level: t.level,
    website: t.website,
    reported: row !== undefined,
    status: row?.status ?? 'missing',
    success: row?.[verdictField] === 'success',
    verdict: row?.[verdictField] ?? '',
    rubrics_passed: row?.rubricScore?.passed ?? '',
    rubrics_total: row?.rubricScore?.total ?? '',
    rubric_score: row?.rubricScore?.score ?? (args.dataset === 'odysseys' ? 0 : ''),
    blocked: row?.blocked ?? '',
    duration_s: row ? Math.round(row.durationMs / 1000) : '',
    llm_calls: row?.llmCalls ?? '',
    tool_calls: row?.toolCalls ?? '',
    cost_usd: row?.costUsd === undefined ? '' : row.costUsd.toFixed(4),
  };
});

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const nums = (group, key) => group.map((t) => t[key]).filter((v) => typeof v === 'number' || (v !== '' && !Number.isNaN(Number(v)))).map(Number);

function summarize(group) {
  const out = {
    tasks: group.length,
    success: group.filter((t) => t.success).length,
    success_rate: group.filter((t) => t.success).length / group.length,
  };
  if (args.dataset === 'odysseys') {
    out.rubric_avg = mean(group.map((t) => Number(t.rubric_score) || 0));
    out.rubrics_passed = group.reduce((a, t) => a + (Number(t.rubrics_passed) || 0), 0);
    out.rubrics_total = group.reduce((a, t) => a + (Number(t.rubrics_total) || 0), 0);
  }
  return out;
}

const summary = {
  dataset: args.dataset,
  metric:
    args.dataset === 'odysseys'
      ? 'success = every rubric of the task passed ("Perfect"); rubric_avg = mean per-task rubric score'
      : 'success = WebJudge (trajectory) verdict',
  ...identity,
  shards,
  overall: summarize(perTask),
  by_level: Object.fromEntries(
    [...new Set(tasks.map((t) => t.level))].sort().map((level) => [level, summarize(perTask.filter((t) => t.level === level))]),
  ),
  status: Object.fromEntries(
    [...new Set(perTask.map((t) => t.status))].sort().map((s) => [s, perTask.filter((t) => t.status === s).length]),
  ),
  not_reported_by_any_shard: perTask.filter((t) => !t.reported).map((t) => t.task_id),
  judge_unknown: perTask.filter((t) => t.verdict === 'unknown').length,
  bot_wall_seen: perTask.filter((t) => t.blocked !== '').length,
  per_task: {
    duration_s: { mean: mean(nums(perTask, 'duration_s')), median: median(nums(perTask, 'duration_s')) },
    llm_calls: { mean: mean(nums(perTask, 'llm_calls')), median: median(nums(perTask, 'llm_calls')) },
    tool_calls: { mean: mean(nums(perTask, 'tool_calls')), median: median(nums(perTask, 'tool_calls')) },
    cost_usd: { mean: mean(nums(perTask, 'cost_usd')), median: median(nums(perTask, 'cost_usd')), total: nums(perTask, 'cost_usd').reduce((a, b) => a + b, 0) },
  },
  input_tokens_per_llm_call: (() => {
    const withUsage = [...rows.values()].filter((r) => r.llmCalls > 0);
    const calls = withUsage.reduce((a, r) => a + r.llmCalls, 0);
    return calls ? Math.round(withUsage.reduce((a, r) => a + r.inputTokens, 0) / calls) : null;
  })(),
  tool_mix: (() => {
    const counts = {};
    for (const r of rows.values()) for (const name of r.toolNames ?? []) counts[name] = (counts[name] ?? 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, n]) => [name, { calls: n, share: n / total }]));
  })(),
};

mkdirSync(args.out, { recursive: true });
writeFileSync(join(args.out, 'results.json'), JSON.stringify(summary, null, 2) + '\n');
const columns = Object.keys(perTask[0]);
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync(
  join(args.out, 'tasks.csv'),
  [columns.join(','), ...perTask.map((t) => columns.map((c) => csvCell(t[c])).join(','))].join('\n') + '\n',
);

for (const [taskId, row] of rows) {
  const dest = join(args.out, 'results', taskId);
  mkdirSync(dest, { recursive: true });
  for (const [from, to] of [['result.json', 'result.json'], ['session-evidence.json', 'session.json']]) {
    if (existsSync(join(row.taskDir, from))) copyFileSync(join(row.taskDir, from), join(dest, to));
  }
  const { taskDir, costUsd, llmCalls, toolCalls, toolNames, inputTokens, sessionId, operation, ...verdict } = row;
  writeFileSync(join(dest, 'verdict.json'), JSON.stringify({ ...verdict, llmCalls, toolCalls, costUsd }, null, 2) + '\n');
}

const pct = (x) => (x * 100).toFixed(1) + '%';
console.log(`${args.dataset}: ${summary.overall.success}/${summary.overall.tasks} = ${pct(summary.overall.success_rate)}  (agent ${identity.model}, judge ${args.dataset === 'om2w' ? identity.officialJudgeVersion : identity.judgeModel})`);
for (const [level, s] of Object.entries(summary.by_level)) console.log(`  ${level.padEnd(7)} ${s.success}/${s.tasks} = ${pct(s.success_rate)}`);
if (summary.not_reported_by_any_shard.length) console.log(`  WARNING: ${summary.not_reported_by_any_shard.length} task(s) reported by no shard — scored as failures`);
