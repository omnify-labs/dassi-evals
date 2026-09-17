# Methodology

Everything needed to interpret the numbers in this repository, including the places where our setup differs from each benchmark's reference protocol.

## Agent under test

| | |
|---|---|
| Product | [Dassi](https://dassi.ai) Chrome extension, release **0.74.1**, unmodified |
| Model | `gemini-3.8-flash` — the default model a Dassi user gets with no configuration. Default reasoning settings. |
| Interface | Dassi's standard tool surface: a JavaScript REPL over the page, accessibility-tree snapshots, element interaction, navigation and tabs. Screenshots are available to the agent but are not its primary observation. |
| Attempts | One per task. No best-of-N, no human intervention, no per-task or per-site prompt tuning. |
| Budget | 30-minute wall-clock limit per task. **No step cap.** |
| Logins | None. The browser profile is signed in to Dassi only; no website accounts or cookies are provisioned. |

If Chrome itself crashes or cannot be restarted, the harness restarts the browser and runs that task again from the start; the agent never sees the earlier attempt. A task that still fails is recorded with `status: error` and scored as a failure.

## Environment

Tasks ran on GitHub Actions self-hosted Linux runners, one fresh container per shard (4 GiB memory limit). Each shard launches Chrome for Testing in Chrome's new headless mode with the extension loaded, resets the agent session between tasks, and records a screenshot every 5 seconds plus one per action.

Two settings affect how websites treat the browser, so we state them:

- The `HeadlessChrome` token is removed from the user-agent string.
- Traffic leaves through a single residential IP address rather than a datacenter range.

No CAPTCHA-solving service is used. When the agent meets a bot check it may attempt it like any other page element. Tasks where a bot wall was detected are flagged (`blocked` in `tasks.csv`) and **stay in the denominator**.

## Datasets

| Benchmark | Revision | Tasks |
|---|---|---|
| [Online-Mind2Web](https://huggingface.co/datasets/osunlp/Online-Mind2Web) | `6aa56e07c9d247fcc2b72fc3d94ad0f857f1e5d4` | 300 (80 easy / 141 medium / 79 hard) |
| [Odysseys](https://github.com/ljang0/Odysseys) | `95307c76f296292ed8ab9d55bc856095e3eabee5` | 200 (45 easy / 46 medium / 109 hard), 1,225 rubric items |

Every task in each set was run. A task that produced no result is scored as a failure, never dropped.

## Task instructions

The agent receives the dataset's task text inside a short wrapper.

**Online-Mind2Web** — start at the task's website; work in one tab; no search engines; no cached or archived copies; finish with a plain-text final answer. This follows the maintainers' rule that a task starts from the specified site.

**Odysseys** — start at the task's URL (always `https://www.google.com`); search engines and new tabs allowed; no cached or archived copies; if a site cannot be reached, say so rather than answering from memory; finish with a plain-text final answer.

## Grading

Grading is automated. We use our own judge configuration, described here in full. **These scores were not produced by, submitted to, or verified by either benchmark's maintainers.**

### Odysseys

- Judge model: **`gemini-3.5-flash-lite`**. The Odysseys authors use `gemini-3.1-flash-lite-preview`; ours is the successor in the same model tier.
- One judge call per rubric item. The judge sees that rubric's requirement and verification text, the agent's final answer, the action history, and the 8 most recent screenshots.
- **Perfect** (headline): a task counts only if every one of its rubric items passes. **Rubric average**: mean of per-task pass fractions.
- Differences from the reference scorer (`run_full_trajectory_per_rubric.py`): the reference shows the judge every step's screenshot and passes a rubric if any step satisfies it; ours shows the final 8 screenshots plus the full action history. The reference runs agents with a 100-step budget (some leaderboard entries disclose 200); ours has a time limit and no step cap. Tool-call counts per task are in `odysseys/tasks.csv`.

### Online-Mind2Web

- Judge: the benchmark's **WebJudge** pipeline (key-point extraction → per-screenshot relevance scoring → final verdict) at upstream commit `f0d805ee0e9e0b3ea70911e45e5264b72968f3dc`, prompts and thresholds unchanged.
- Backbone model: **`gemini-3.1-pro-preview`**. The official leaderboard uses `o4-mini`.
- Evidence: the official format is one screenshot per UI action. Much of Dassi's work happens in code, so each REPL call is exported as an action with its source code and returned text, alongside its screenshot. Up to 50 relevant screenshots are kept, spread across the trajectory and always including the first and last relevant ones. This is identified in every result as `dassi-webjudge-evidence-v1`.
- WebJudge grades the trajectory, not just the answer: a correct final answer reached without on-page evidence can still be marked a failure.

## Reading the per-task files

Each `<benchmark>/results/<task_id>/` folder holds:

- `result.json` — task text, final answer, action history (Online-Mind2Web v2 schema).
- `session.json` — the full agent session: every model turn, tool call, tool output, and per-call token usage and cost.
- `verdict.json` — run status, duration, judge verdict and reasoning, rubric counts, model-call and tool-call totals, cost.

`session.json` contains web page content exactly as the agent read it, which can include addresses, phone numbers or keys that those sites publish. The extension's internal service-worker logs are not included. Screenshots are attached to the repository's release as one archive per shard.

## Reproducing the aggregation

```bash
node scripts/aggregate.mjs --dataset odysseys --shards <extracted-shards-dir> --tasks odysseys.json --out odysseys
node scripts/aggregate.mjs --dataset om2w --shards <extracted-shards-dir> --tasks Online_Mind2Web.json --out om2w
```

The script refuses to run if shards disagree on agent or judge identity, if a task appears in two shards, or if a shard reports a task that is not in the dataset.
