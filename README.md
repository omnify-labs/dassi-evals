# Dassi evals

Full results, per-task logs and grading details for [Dassi](https://dassi.ai) on three live-web agent benchmarks:

- **[Odysseys](https://odysseysbench.com/)** — 200 long-horizon, multi-site tasks reconstructed from real browsing sessions, graded against 1,225 rubric items.
- **[Online-Mind2Web](https://github.com/OSU-NLP-Group/Online-Mind2Web)** — 300 tasks across 136 live websites.
- **[BU Bench V2](https://github.com/browser-use/benchmark)** — 200 long web tasks from Browser Use, graded against weighted findings rubrics. Scores and costs only; see below for why there are no per-task logs.

Dassi is a Chrome extension. It was run as shipped on its default model, `gemini-3.8-flash`, with one attempt per task: release 0.74.1 for Odysseys and Online-Mind2Web, release 0.79.0 for BU Bench V2.

> **How these were graded.** Scores come from automated LLM judges that we ran ourselves, all on `gemini-3.5-flash-lite`. Odysseys is graded rubric by rubric. Online-Mind2Web is graded on whether the final result is right, however the agent got there. We also report Online-Mind2Web's own WebJudge, which grades the process too. None of these scores has been submitted to or verified by either benchmark's maintainers. [METHODOLOGY.md](METHODOLOGY.md) lists every difference from the reference protocols.

## Results

### Odysseys — 200 tasks

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Perfect (every rubric passed) | **183 / 200 (91.5%)** |
| Rubric average | 95.0% |
| Rubric items passed | 1,159 / 1,225 (94.6%) |
| Easy / Medium / Hard (Perfect) | 43/45 (95.6%) · 39/46 (84.8%) · 101/109 (92.7%) |
| Perfect within 100 / 200 model calls | 157 (78.5%) · 182 (91.0%) |
| Median tool calls per task | 60 |
| Median time per task | 6 min 2 s |
| Median model cost per task | $0.66 |

Published Odysseys runs cap the agent at 100 or 200 steps; Dassi ran uncapped. The "within" row counts tasks that were perfect within that many model calls. A Dassi model call can run code that performs several browser actions, so it is not the same unit as one step of a screenshot-and-click agent.

### Online-Mind2Web — 300 tasks

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Correct result (answer judge) | **289 / 300 (96.3%)** |
| Easy / Medium / Hard | 78/80 (97.5%) · 135/141 (95.7%) · 76/79 (96.2%) |
| WebJudge, which also grades the process | 274 / 300 (91.3%) |
| Median tool calls per task | 31 |
| Median time per task | 2 min 14 s |
| Median model cost per task | $0.32 |

### BU Bench V2 — 200 tasks

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Mean weighted findings score (0 to 100) | **84.7** |
| Tasks with every rubric item met | 126 / 200 (63.0%) |
| Public 55-task subset (`bu2-001` to `bu2-055`) / other 145 tasks | 92.0 · 82.0 |
| Median time per task | 5 min 41 s |
| Model cost per task, 20-task sample | mean $0.92 · median $1.01 |

Graded with our own run of the findings judge on `gemini-3.5-flash-lite`. Browser Use grades with `gpt-5.6-luna` at xhigh reasoning and publishes results on an earlier 60-task cut, so this score is **not comparable** to theirs. No task was re-run. One task (`bu2-002`) could not start because its website did not resolve on the day and scores 0; six were cut off by a harness bug (see [METHODOLOGY.md](METHODOLOGY.md)) and are scored as they stood.

Browser Use asks that decrypted tasks and traces not be published, so this folder has no task text, answers, sessions or screenshots: [`bubench-v2/results.json`](bubench-v2/results.json) (summary), [`bubench-v2/tasks.csv`](bubench-v2/tasks.csv) (score and status per task id), [`bubench-v2/cost-sample.csv`](bubench-v2/cost-sample.csv) (tokens and cost for the 20-task cost sample).

Summary numbers: [`odysseys/results.json`](odysseys/results.json), [`om2w/results.json`](om2w/results.json). One row per task: [`odysseys/tasks.csv`](odysseys/tasks.csv), [`om2w/tasks.csv`](om2w/tasks.csv). Failed, timed-out and crashed tasks are all included and count as failures.

## Other published results

These are other teams' published numbers, for context. They were produced with different agents, models, step budgets and judges, so treat them as neighbours on a map, not as a controlled comparison. Retrieved 2026-09-17.

### Odysseys — Perfect rate

| Entry | Perfect | Model | Judge | Steps | Source |
|---|---|---|---|---|---|
| Skyvern | 90.5% | Claude Opus 5 | official per-rubric judge | 100 steps (avg 65) | [official leaderboard](https://odysseysbench.com/leaderboard.html) |
| BrowserCode (Browser Use) | 86.0% | GPT-5.6 Luna | `gemini-3.1-flash-lite`, mean of 3 passes | avg 124 steps | official leaderboard |
| Aside | 75.5% | GPT-5.5 | `gemini-3.1-flash-lite` | 200 steps | [at-inc/aside-benchmarks](https://github.com/at-inc/aside-benchmarks) |
| BrowserCode (Browser Use) | 65.0% | Claude Opus 4.7 | `gemini-3.1-flash-lite` | avg 52 steps | official leaderboard |
| WebWright (Microsoft Research) | 60.1% | GPT-5.4 | not stated | avg 76 steps | official leaderboard |
| Gemini 3.5 Flash (Google DeepMind) | 48.0% | Gemini 3.5 Flash | not stated | avg 81 steps | official leaderboard |
| Claude Opus 4.6 (computer use) | 44.5% | Claude Opus 4.6 | `gemini-3.1-flash-lite-preview` | 100-step budget (76.5% at 200) | [paper, Table 2](https://arxiv.org/abs/2604.24964) |
| GPT-5.4 (computer use) | 33.5% | GPT-5.4 | `gemini-3.1-flash-lite-preview` | 100-step budget | paper, Table 2 |

### Online-Mind2Web — success rate

| Entry | Success | Model | Judge | Source |
|---|---|---|---|---|
| Aside | 99.0% (297/300) | GPT-5.5 | own `gpt-5.4` grader | [at-inc/aside-benchmarks](https://github.com/at-inc/aside-benchmarks) |
| Browser Use Cloud (`bu-max`) | 97.0% (291/300) | proprietary | own Claude-based judge | [browser-use/online-mind2web](https://github.com/browser-use/online-mind2web) |

Neither row above, nor ours, appears on the [official Online-Mind2Web leaderboard](https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard), which lists results its maintainers have verified with the `o4-mini` WebJudge or human evaluation.

### BU Bench V2 — mean weighted findings score

From Browser Use's own chart, `official_plots/bu_bench_v2_astra.jpg` in [browser-use/benchmark](https://github.com/browser-use/benchmark), dated 2026-09-23: all on their harness, the legacy 60-task cut, graded by `gpt-5.6-luna` xhigh. Cost is recorded agent cost per task, judge excluded. Retrieved 2026-09-24.

| Entry | Score | Cost per task |
|---|---|---|
| GPT-6 Astra medium | 80.6 | $8.87 |
| GPT-6 Sol medium | 66.9 | $1.20 |
| Claude Opus 5.5 | 59.4 | $4.21 |
| GPT-6 Luna xhigh | 57.6 | $0.19 |
| Claude Fable 5.1 high | 56.2 | $8.11 |
| DeepSeek V4.1 Flash max | 47.9 | $0.26 |
| Gemini 3.7 Flash | 9.6 | $1.00 |

## Repository layout

```
odysseys/
  results.json          summary: overall, by difficulty, status counts, cost
  tasks.csv             one row per task
  results/<task_id>/    result.json · session.json · verdict.json
om2w/
  (same structure)
bubench-v2/
  results.json          summary: overall, subsets, status and failure counts, cost sample
  tasks.csv             score and status per task id (no task text)
  cost-sample.csv       tokens and cost for 20 tasks
scripts/aggregate.mjs   merges the CI shards into the files above
METHODOLOGY.md          agent setup, environment, prompts, grading, known differences
```

Screenshots are not included in this repository yet.

## Data and licenses

Each task's text is reproduced in its `result.json`. Rubrics are not; they are in the Odysseys dataset.

- Online-Mind2Web tasks: © OSU NLP Group, [CC BY 4.0](https://huggingface.co/datasets/osunlp/Online-Mind2Web), revision `6aa56e07`.
- Odysseys tasks: © the Odysseys authors, [MIT](https://github.com/ljang0/Odysseys/blob/main/LICENSE), revision `95307c76`.

## Questions and corrections

If a task looks mis-graded in either direction, open an issue with the task id. The judge's reasoning and the full session are in that task's folder.
