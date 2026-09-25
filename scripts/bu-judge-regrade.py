"""Grade saved dassi BU Bench V2 runs with Browser Use's own findings judge (evaluation.judge_trace).

Run from a checkout of github.com/browser-use/benchmark at cc09d941 after `uv sync --frozen`:
    GOOGLE_API_KEY=... uv run python bu-judge-regrade.py gemini-3.8-flash deepseek=<results dir> [...]
    OPENAI_API_KEY=... uv run python bu-judge-regrade.py luna deepseek=<results dir>   # Browser Use's own judge model
A results dir is one extracted CI shard (benchmark/results/<timestamp>/) with run-state.json and task*/ folders.
Env: SKIP=label:task,... to skip graded tasks; CONCURRENCY (default 4).
"""
import asyncio, base64, glob, json, os, sys
from pathlib import Path
from browser_use import ChatGoogle
from evaluation import create_judge, judge_trace, load_tasks

judge_name, *run_dirs = sys.argv[1:]
class GoogleStopAsOpenAI:
    """Browser Use's judge accepts only OpenAI's 'stop'; the Google client reports FinishReason.STOP."""

    def __init__(self, inner):
        self.inner, self.model = inner, inner.model

    async def ainvoke(self, messages, output_format=None):
        response = await self.inner.ainvoke(messages, output_format=output_format)
        if str(getattr(response, "stop_reason", "")).upper().endswith("STOP"):
            object.__setattr__(response, "stop_reason", "stop")
        return response


llm = create_judge() if judge_name == "luna" else GoogleStopAsOpenAI(ChatGoogle(model=judge_name, api_key=os.environ["GOOGLE_API_KEY"], max_output_tokens=32768, temperature=0))
tasks = {t["task_id"]: t for t in load_tasks()}


def trace_from_session(task_dir: Path) -> dict:
    """A timed-out run writes no result.json; rebuild its steps from the saved session."""
    session = json.loads((task_dir / "session-evidence.json").read_text())
    steps, last_text = [], ""
    for message in session.get("messages", []):
        for part in message.get("content") or []:
            if part.get("type") == "text" and part.get("text"):
                last_text = part["text"]
            elif part.get("type") == "tool-call":
                output = part.get("result", {}).get("content") or []
                output_text = "\n".join(c.get("text", "") for c in output if isinstance(c, dict))[:4000]
                steps.append({"action": f"Tool: {part.get('toolName')}; execution status: {part.get('status')}\n"
                              f"Arguments: {part.get('argsText') or json.dumps(part.get('args'))}\nResult: {output_text}"})
    return {"task_id": "bu2-" + task_dir.name.split("-")[-1], "agent_final_answer": last_text, "action_history": steps}


async def grade(task_dir: Path, ours: dict, label: str):
    result = trace_from_session(task_dir) if not (task_dir / "result.json").exists() else json.loads((task_dir / "result.json").read_text())
    frames = sorted((task_dir / "trajectory").glob("*.png")) or sorted(task_dir.glob("screenshot*.png"))
    trace = {
        "final_result": result.get("agent_final_answer") or "",
        "agent_steps": [a["action"] for a in result.get("action_history", [])],
        "screenshots_b64": [base64.b64encode(f.read_bytes()).decode() for f in frames],
        "screenshot_timing": "after",
    }
    tid = result["task_id"]
    try:
        out = await judge_trace(tasks[tid], trace, llm)
        (task_dir / f"bu-judge-{judge_name}.json").write_text(json.dumps(out, default=str))
    except Exception as e:  # noqa: BLE001 - report and continue with the next task
        print(json.dumps({"model": label, "task": tid, "error": str(e)[:300]}), flush=True)
        return
    statuses = [f["status"] for f in out.get("judgement", {}).get("findings", [])] if "judgement" in out else []
    print(json.dumps({
        "model": label, "task": tid, "frames": len(frames),
        "ours": round(ours.get("score", 0) * 100) if ours else None,
        "bu_score": round((out.get("score") or 0) * 100, 1),
        "bu_diagnostic": round((out.get("diagnostic_score", out.get("score")) or 0) * 100, 1),
        "incomplete": bool(out.get("evidence_incomplete") or out.get("evidence_incomplete_items")),
        "rh": out.get("rh_zeroed"), "met": statuses.count("met"), "violated": statuses.count("violated"),
        "not_assessable": statuses.count("not_assessable"),
    }), flush=True)

async def main():
    jobs = []
    for rd in run_dirs:
        label, path = rd.split("=", 1)
        state = json.loads(Path(path, "run-state.json").read_text())
        ours = {r["taskId"]: r.get("findingsScore") or {} for r in state["results"]}
        for d in sorted(Path(path).glob("taskbu2-*")):
            tid = d.name[4:]
            if int(tid[4:]) > 55 or not ((d / "result.json").exists() or (d / "session-evidence.json").exists()) or f"{label}:{tid}" in os.environ.get("SKIP", "").split(","):
                continue
            jobs.append((d, ours.get(tid), label))
    gate = asyncio.Semaphore(int(os.environ.get("CONCURRENCY", "4")))

    async def bounded(job):
        async with gate:
            await grade(*job)

    await asyncio.gather(*(bounded(j) for j in jobs))

asyncio.run(main())
