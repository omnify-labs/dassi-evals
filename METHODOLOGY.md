# Methodology

Everything needed to interpret the numbers in this repository, including the places where our setup differs from each benchmark's reference protocol.

## Agent under test

| | |
|---|---|
| Product | [Dassi](https://dassi.ai) Chrome extension, unmodified: release **0.74.1** for Odysseys and Online-Mind2Web, **0.80.0** for BU Bench V2 |
| Model | `gemini-3.8-flash` — the default model a Dassi user gets with no configuration. Default reasoning settings. |
| Interface | Dassi's standard tool surface: a JavaScript REPL over the page, accessibility-tree snapshots, element interaction, navigation and tabs. Screenshots are available to the agent but are not its primary observation. |
| Attempts | One per task. No best-of-N, no human intervention, no per-task or per-site prompt tuning. |
| Budget | 30-minute wall-clock limit per task. **No step cap.** |
| Logins | None. The browser profile is signed in to Dassi only; no website accounts or cookies are provisioned. |

If Chrome itself crashes, the harness restarts the browser and runs that task again from the start; the agent never sees the earlier attempt. A task the agent started and did not finish is recorded with `status: error` or `timeout` and scored as a failure.

Infrastructure failures are handled by these rules. None of them depends on how any task scored.

- **A shard killed by the runner** (out of memory, exit 137) is discarded in full and its tasks run again in fresh shards. None of the killed shard's results are used.
- **A shard whose tasks all ran but whose grading failed** keeps its agent attempts; only the grading is redone. Agent attempts are never repeated to fix a grading failure.
- **A task the agent never started** — the harness recorded an error in under 5 seconds with no answer, for example because Chrome failed to restart — is run again in a later shard, and that attempt is scored. A task the agent started is never re-run, whatever its outcome.
- **A task the harness could not read back.** The agent ran, but the harness timed out reading the finished session out of the extension (`Session export timed out`), so there is no answer to grade. The task is run once more and that attempt is scored, even if it also comes back empty. The export exists only for benchmarking; users never see it.

Every re-run is listed in `results.json` (`rerun_no_result`, with the reason) so it can be checked.

**BU Bench V2 had no re-runs at all.** A task that hit the 30-minute limit is graded on the evidence it had produced by then (four tasks in the DeepSeek run, none in the Gemini run).

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
| [BU Bench V2](https://github.com/browser-use/benchmark) | `421390ea7fa4708f3d89d7695f9a16debb861daf` (predates Browser Use's 2026-09-24 fixes to seven task rubrics) | 200, one weighted findings rubric each |

Every task in each set was run. A task that produced no result is scored as a failure, never dropped.

## Task instructions

The agent receives the dataset's task text inside a short wrapper.

**Online-Mind2Web** — start at the task's website; work in one tab; no search engines; no cached or archived copies; finish with a plain-text final answer. This follows the maintainers' rule that a task starts from the specified site.

**BU Bench V2** — each task names its own starting site inline; the agent may search and open tabs; finish with a plain-text final answer.

**Odysseys** — start at the task's URL (`https://www.google.com` for 130 of the 200 tasks; the other 70 start on one of 56 specific sites); search engines and new tabs allowed; no cached or archived copies; if a site cannot be reached, say so rather than answering from memory; finish with a plain-text final answer.

## Grading

Grading is automated. We use our own judge configuration, described here in full. **These scores were not produced by, submitted to, or verified by any of the benchmarks’ maintainers.**

### Odysseys

- **Headline: the official scorer.** `scripts/python/run_full_trajectory_per_rubric.py` from the Odysseys repository at `95307c76`, unmodified, on its default judge `gemini-3.1-flash-lite-preview`. It grades each rubric item in one call that sees the task, the item's requirement and verification text, the full action history, and every screenshot of the trajectory, and answers success or failure. Its rules include: ground the judgment in what the screenshots and actions show; filters, sorts and forms must be applied and confirmed; an agent that was blocked (CAPTCHA, access denied) and therefore could not satisfy the item fails.
- **Evidence.** [`scripts/odysseys-official-regrade.py`](scripts/odysseys-official-regrade.py) turns each published attempt into the scorer's `steps.jsonl` format: one row per Dassi model call, with the call's action, its reasoning, and that call's screenshot. 194 tasks have this evidence; the other 6 produced no result and count as failures.
- **Step budget.** The scorer's default `--max-steps 100` stops reading after step 100. We report no cap (`--max-steps 0`), 200 steps, and the default 100.
- **Our earlier judge (retired).** Our first figure, 91.5% Perfect, came from our own rubric judge on `gemini-3.5-flash-lite`, with the final 8 screenshots and no blocked-site rule. It is kept in `tasks.csv` as `success` and `rubrics_passed` for comparison.

### Online-Mind2Web

**Headline: is the result right?** We grade whether the agent's final result satisfies the task, not how it got there. Filtering or sorting a site's data in code counts the same as clicking the site's filter.

- Judge model: **`gemini-3.5-flash-lite`**, one call per task.
- The judge sees the task text, the agent's final answer, and the last 3 screenshots of the run.
- It is told not to penalize the navigation path, and to use the screenshots to catch answers they contradict or that look made up.
- A task with no final answer fails without a judge call.

**Secondary: WebJudge, reported per task.** We also ran the benchmark's own **WebJudge** pipeline (key-point extraction → per-screenshot relevance scoring → final verdict) at upstream commit `f0d805ee0e9e0b3ea70911e45e5264b72968f3dc`, prompts and thresholds unchanged.

- It grades the process as well as the result. A correct answer fails if the site's filter or sort was not applied through the page itself.
- Backbone model: `gemini-3.1-pro-preview`; the official leaderboard uses `o4-mini`.
- Evidence: each REPL call is exported as an action with its source code and returned text, alongside its screenshot. Up to 50 relevant screenshots are kept, spread across the run and always including the first and last relevant ones (`dassi-webjudge-evidence-v1`).
- Its verdict is the `webjudge` column of `om2w/tasks.csv` and `webjudge_success` in `om2w/results.json`.

Aside and Browser Use also grade Online-Mind2Web on the result with their own LLM judges, so the headline is closer to how their numbers were produced. The official leaderboard ranks by WebJudge.

**Where the two judges disagree.** An answer judge can credit an answer the agent never actually read from the page, so we checked every disagreement against WebJudge's written reasoning.

| | WebJudge pass | WebJudge fail |
|---|---|---|
| Answer judge pass | 266 | 23 |
| Answer judge fail | 8 | 2 (+1 with no WebJudge verdict) |

- In 18 of the 23, WebJudge objects only to how the result was reached: a filter or sort applied in code rather than by clicking it.
- In 5, WebJudge says the result itself falls short, and we count them as contested: `9d090a15…`, `9af05e39…`, `5dec0e66…`, `c6c9dc60…`, `a48e2f1e…`. Without them the headline would be 284/300.
- In none of them does WebJudge say the answer was made up rather than read from the page.

### BU Bench V2 with Browser Use's judge

- Agent: Dassi 0.80.0, unmodified, on `deepseek-v4-flash-vision-exp`, which the DeepSeek API serves as V4.1 Flash; it is the DeepSeek id Dassi sends screenshots to. Reasoning level high, Dassi's main-agent setting, sent as `reasoning_effort: high`. The Gemini 3.8 Flash run uses the same release, tasks, reasoning level and judge.
- Tasks: the 55-task public subset at the dataset revision `BU_Bench_V2_55.json` pins (`cc09d941`), run as five shards of 10 or 11 tasks, one attempt each, 30-minute limit, no step cap.
- Judge: Browser Use's `evaluation.judge_trace` at `cc09d941`, called directly from [`scripts/bu-judge-regrade.py`](scripts/bu-judge-regrade.py) on the saved runs. Browser Use's code decrypts the tasks and supplies the rubric and weights; the script supplies Dassi's final answer, its step history, and its screenshots (up to 50 after Browser Use's own selection). Model `gemini-3.8-flash`, 32,768 output tokens, temperature 0. Browser Use uses `gpt-5.6-luna` at xhigh reasoning. Two adaptations: Google's finish code `STOP` is mapped to the `stop` Browser Use's code expects, and the four timed-out tasks, which wrote no final answer file, have their steps rebuilt from the saved session.
- Cost: the sum of each model call's tokens at list price. DeepSeek V4.1 Flash: all calls fell in DeepSeek's off-peak hours; the peak price is double. Gemini 3.8 Flash: introductory price, which doubles on 2027-01-01. Judge cost is excluded, as in Browser Use's chart.

An earlier Gemini 3.8 Flash result on all 200 tasks was graded by our own port of the judge on `gemini-3.5-flash-lite`. It proved far too lenient and has been withdrawn.

## Reading the per-task files

Each `<benchmark>/results/<task_id>/` folder holds:

- `result.json` — task text, final answer, action history (Online-Mind2Web v2 schema).
- `session.json` — the full agent session: every model turn, tool call, tool output, and per-call token usage and cost.
- `verdict.json` — run status, duration, judge verdict and reasoning, rubric counts, model-call and tool-call totals, cost.

Dassi appends its own context to each task prompt: a note on the open tabs, its memory instructions and a page thumbnail. In `session.json` that block is replaced with `<!-- dassi:system-context omitted -->`. The task text and everything the agent did and read are unchanged.

`session.json` contains web page content exactly as the agent read it, which can include addresses and phone numbers that those sites publish. Credentials that sites exposed in their pages or network traffic (Google API keys, JWT session tokens, bearer tokens) are replaced with `[REDACTED]`. The extension's internal service-worker logs and the run screenshots are not included.

## Reproducing the aggregation

```bash
node scripts/aggregate.mjs --dataset odysseys --shards <extracted-shards-dir> --tasks odysseys.json --out odysseys
node scripts/aggregate.mjs --dataset om2w --shards <extracted-shards-dir> --tasks Online_Mind2Web.json --out om2w
```

The script refuses to run if shards disagree on agent or judge identity, if a task appears in two shards, or if a shard reports a task that is not in the dataset.
