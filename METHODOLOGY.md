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

If Chrome itself crashes, the harness restarts the browser and runs that task again from the start; the agent never sees the earlier attempt. A task the agent started and did not finish is recorded with `status: error` or `timeout` and scored as a failure.

Two infrastructure failures are handled by re-running, under rules that do not depend on how any task scored:

- **A shard killed by the runner** (out of memory, exit 137) is discarded in full and its tasks run again in fresh shards. None of the killed shard's results are used.
- **A shard whose tasks all ran but whose grading failed** keeps its agent attempts; only the grading is redone. Agent attempts are never repeated to fix a grading failure.
- **A task the agent never started** — the harness recorded an error in under 5 seconds with no answer, for example because Chrome failed to restart — is run again in a later shard, and that attempt is scored. A task the agent started is never re-run, whatever its outcome.

- **A task the harness could not read back.** The agent ran, but the harness timed out reading the finished session out of the extension (`Session export timed out`), so there is no answer to grade. The task is run once more and that attempt is scored, even if it also comes back empty. The export exists only for benchmarking; users never see it.

Every re-run is listed in `results.json` (`rerun_no_result`, with the reason) so it can be checked.

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

**Odysseys** — start at the task's URL (`https://www.google.com` for 130 of the 200 tasks; the other 70 start on one of 56 specific sites); search engines and new tabs allowed; no cached or archived copies; if a site cannot be reached, say so rather than answering from memory; finish with a plain-text final answer.

## Grading

Grading is automated. We use our own judge configuration, described here in full. **These scores were not produced by, submitted to, or verified by either benchmark's maintainers.**

### Odysseys

- Judge model: **`gemini-3.5-flash-lite`**. The Odysseys authors use `gemini-3.1-flash-lite-preview`; ours is the successor in the same model tier.
- One judge call per rubric item. The judge sees that rubric's requirement and verification text, the agent's final answer, the action history, and the 8 most recent screenshots.
- **Perfect** (headline): a task counts only if every one of its rubric items passes. **Rubric average**: mean of per-task pass fractions.
- 53 tasks (CI runs 35279908345, 35279913818 and 35303493831) finished every task, but the CI job ended during grading after one Gemini API error (`503`). Those agent attempts are kept and graded outside CI with the same judge code, retrying provider errors. By then the upload step had removed the periodic screenshots, so the judge saw the last 8 per-action screenshots instead.
- Differences from the reference scorer (`run_full_trajectory_per_rubric.py`): the reference shows the judge every step's screenshot and passes a rubric if any step satisfies it; ours shows the final 8 screenshots plus the full action history. The reference runs agents with a 100-step budget (some leaderboard entries disclose 200); ours has a time limit and no step cap. Tool-call counts per task are in `odysseys/tasks.csv`.

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
