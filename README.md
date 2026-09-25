# Dassi evals

Full results, per-task logs and grading details for [Dassi](https://dassi.ai) on three live-web agent benchmarks:

- **[Odysseys](https://odysseysbench.com/)** — 200 long-horizon, multi-site tasks reconstructed from real browsing sessions, graded against 1,225 rubric items.
- **[Online-Mind2Web](https://github.com/OSU-NLP-Group/Online-Mind2Web)** — 300 tasks across 136 live websites.
- **[BU Bench V2](https://github.com/browser-use/benchmark)** — 200 long web tasks from Browser Use, graded against weighted findings rubrics. Scores and costs only; see below for why there are no per-task logs.

Dassi is a Chrome extension, run as shipped with one attempt per task: release 0.74.1 on its default model `gemini-3.8-flash` for Odysseys and Online-Mind2Web; release 0.80.0 on DeepSeek V4.1 Flash and on `gemini-3.8-flash` for BU Bench V2.

> **How these were graded.** Scores come from automated LLM judges that we ran ourselves. Odysseys uses the Odysseys authors' own scorer and default judge model, rubric by rubric. BU Bench V2 uses Browser Use's own judge code on `gemini-3.8-flash`. Online-Mind2Web's headline uses our own judge on `gemini-3.5-flash-lite`. Online-Mind2Web is graded on whether the final result is right, however the agent got there. We also report Online-Mind2Web's own WebJudge, which grades the process too. None of these scores has been submitted to or verified by either benchmark's maintainers. [METHODOLOGY.md](METHODOLOGY.md) lists every difference from the reference protocols.

## Results

### Odysseys — 200 tasks

Graded with the Odysseys authors' official scorer, `run_full_trajectory_per_rubric.py` at revision `95307c76`, unmodified, on its default judge `gemini-3.1-flash-lite-preview`.

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Perfect (every rubric passed), no step cap | **170 / 200 (85.0%)** |
| Perfect within 200 / 100 steps (the scorer's default is 100) | 169 (84.5%) · 150 (75.0%) |
| Rubric items passed, no step cap | 1,142 / 1,225 (93.2%) |
| Easy / Medium / Hard (Perfect, no step cap) | 40/45 · 36/46 · 94/109 (86.2%) |
| Median tool calls per task | 60 |
| Median time per task | 6 min 2 s |
| Median model cost per task | $0.66 |

A Dassi step is one model call, and one call can run code that performs several browser actions, so it is not the same unit as one step of a screenshot-and-click agent. Runs were one attempt per task with a 30-minute limit and no step cap; the step-budget rows count what the scorer grades when it stops reading at that step.

**Why this differs from our first number.** We first published 91.5% Perfect from our own rubric judge. The official scorer fails an item when the site blocked the agent (a CAPTCHA or access-denied page), even if the agent said so honestly and found the information elsewhere; it grades what the trajectory shows rather than the agent's own conclusions; and it needs end-state requirements, such as tabs left open, to be visible. Our runs happen in headless Chrome on a CI server behind one residential proxy, which likely draws more bot checks than a person's own browser would, but the official rule applies to every agent the same way. Per task, `odysseys/tasks.csv` carries both: `success` and `rubrics_passed` from our judge, and the `official_*` columns from the official scorer. The conversion script is [`scripts/odysseys-official-regrade.py`](scripts/odysseys-official-regrade.py).

### Online-Mind2Web — 300 tasks

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Correct result (answer judge) | **289 / 300 (96.3%)** |
| Easy / Medium / Hard | 78/80 (97.5%) · 135/141 (95.7%) · 76/79 (96.2%) |
| WebJudge, which also grades the process | 274 / 300 (91.3%) |
| Median tool calls per task | 31 |
| Median time per task | 2 min 14 s |
| Median model cost per task | $0.32 |

### BU Bench V2 — 55-task subset, graded with Browser Use's judge

| Metric | Dassi (DeepSeek V4.1 Flash) |
|---|---|
| Mean weighted findings score (0 to 100) | **79.0** |
| Mean over the 54 tasks that ran | 80.5 |
| Tasks with every rubric item met | 18 / 55 |
| Model cost per task | **$0.08** mean · $0.079 median · $0.03 to $0.14 (off-peak list price; $0.16 mean at peak) |
| Model cost for the whole run | $4.34 |
| Time per task | 14.7 min mean · 13.1 min median |

The task set is Browser Use's public 55-task subset (`BU_Bench_V2_55.json`, `bu2-001` to `bu2-055`) at the dataset revision that file pins. Grading uses **Browser Use's own judge code** (`evaluation.judge_trace` and `findings_judge.py` at that revision: their prompt, schema, rubric weights, reward-hacking and canary rules, up to 50 screenshots), run on `gemini-3.8-flash` instead of their `gpt-5.6-luna` at xhigh reasoning. A second pass on `gemini-3.1-pro-preview` gave 81.9. `bu2-002` could not start because its website did not resolve and scores 0; four tasks hit the 30-minute limit and are graded on their partial evidence. No task was re-run. The regrade script is [`scripts/bu-judge-regrade.py`](scripts/bu-judge-regrade.py).

Files: [`bubench-v2/deepseek-v4.1-flash/results.json`](bubench-v2/deepseek-v4.1-flash/results.json) (summary) and [`bubench-v2/deepseek-v4.1-flash/tasks.csv`](bubench-v2/deepseek-v4.1-flash/tasks.csv) (score, rubric counts, tokens and cost per task id).

### BU Bench V2 — same 55 tasks, Gemini 3.8 Flash

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Mean weighted findings score (0 to 100) | **56.9** |
| Mean over the 54 tasks that ran | 58.0 |
| Tasks with every rubric item met | 5 / 55 |
| Tasks zeroed for reward hacking | 5 |
| Model cost per task | **$1.01** mean · $0.90 median · $0.45 to $2.65 (introductory list price, doubles on 2027-01-01) |
| Model cost for the whole run | $54.72 |
| Time per task | 8.7 min mean · 8.2 min median |

Same release, task set, harness and judge as the DeepSeek run, at the same reasoning level (high). The judge model here is the same as the agent model, so any self-preference would favour this run. DeepSeek scored higher on 40 of the 54 tasks, Gemini on 9, with 5 ties. Files: [`bubench-v2/gemini-3.8-flash/results.json`](bubench-v2/gemini-3.8-flash/results.json), [`bubench-v2/gemini-3.8-flash/tasks.csv`](bubench-v2/gemini-3.8-flash/tasks.csv).

An earlier 200-task Gemini result (84.7) was graded by our own port of the judge on `gemini-3.5-flash-lite`, which proved far too lenient. It has been withdrawn and its files removed; they remain in this repository's history.

Browser Use asks that decrypted tasks and traces not be published, so the BU Bench V2 folders have no task text, answers, sessions or screenshots.

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
  deepseek-v4.1-flash/  55-task subset graded with Browser Use's judge: results.json · tasks.csv
  gemini-3.8-flash/     same, for gemini-3.8-flash
scripts/aggregate.mjs   merges the CI shards into the files above
scripts/bu-judge-regrade.py  grades saved runs with Browser Use's judge code
METHODOLOGY.md          agent setup, environment, prompts, grading, known differences
```

Screenshots are not included in this repository yet.

## Data and licenses

Each task's text is reproduced in its `result.json`. Rubrics are not; they are in the Odysseys dataset.

- Online-Mind2Web tasks: © OSU NLP Group, [CC BY 4.0](https://huggingface.co/datasets/osunlp/Online-Mind2Web), revision `6aa56e07`.
- Odysseys tasks: © the Odysseys authors, [MIT](https://github.com/ljang0/Odysseys/blob/main/LICENSE), revision `95307c76`.

## Questions and corrections

If a task looks mis-graded in either direction, open an issue with the task id. The judge's reasoning and the full session are in that task's folder.
