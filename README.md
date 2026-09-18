# Dassi evals

Full results, per-task logs and grading details for [Dassi](https://dassi.ai) on two live-web agent benchmarks:

- **[Odysseys](https://odysseysbench.com/)** — 200 long-horizon, multi-site tasks reconstructed from real browsing sessions, graded against 1,225 rubric items.
- **[Online-Mind2Web](https://github.com/OSU-NLP-Group/Online-Mind2Web)** — 300 tasks across 136 live websites.

Dassi is a Chrome extension. It was run as shipped (release 0.74.1) on its default model, `gemini-3.8-flash`, with one attempt per task.

> **How these were graded.** Scores come from automated LLM judges that we ran ourselves, all on `gemini-3.5-flash-lite`. Odysseys is graded rubric by rubric. Online-Mind2Web is graded on whether the final result is right, however the agent got there. We also report Online-Mind2Web's own WebJudge, which grades the process too. None of these scores has been submitted to or verified by either benchmark's maintainers. [METHODOLOGY.md](METHODOLOGY.md) lists every difference from the reference protocols.

## Results

<!-- RESULTS: filled from odysseys/results.json and om2w/results.json once all shards finish -->

### Odysseys — 200 tasks

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Perfect (every rubric passed) | **TBD / 200** |
| Rubric average | TBD |
| Rubric items passed | TBD / 1,225 |
| Easy / Medium / Hard (Perfect) | TBD / TBD / TBD |
| Median tool calls per task | TBD |
| Median cost per task | TBD |

### Online-Mind2Web — 300 tasks

| Metric | Dassi (`gemini-3.8-flash`) |
|---|---|
| Correct result (answer judge) | **TBD / 300** |
| Easy / Medium / Hard | TBD / TBD / TBD |
| WebJudge, which also grades the process | TBD / 300 |
| Median tool calls per task | TBD |
| Median cost per task | TBD |

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

## Repository layout

```
odysseys/
  results.json          summary: overall, by difficulty, status counts, cost
  tasks.csv             one row per task
  results/<task_id>/    result.json · session.json · verdict.json
om2w/
  (same structure)
scripts/aggregate.mjs   merges the CI shards into the files above
METHODOLOGY.md          agent setup, environment, prompts, grading, known differences
```

Screenshots for every task are attached to the [latest release](../../releases) as one archive per shard.

## Questions and corrections

If a task looks mis-graded in either direction, open an issue with the task id. The judge's reasoning and the full session are in that task's folder.
