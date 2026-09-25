"""Build run folders that the Odysseys authors' official scorer can grade, from dassi's CI archives.

    python3 scripts/odysseys-official-regrade.py <extracted-shards-dir> <out-dir>
    python3 run_full_trajectory_per_rubric.py --runs-dir <out-dir> --task-source-json odysseys.json \\
        --output official.json --num-workers 8 [--max-steps 0]

The scorer is scripts/python/run_full_trajectory_per_rubric.py from github.com/ljang0/Odysseys at
95307c76; its default judge is gemini-3.1-flash-lite-preview and its default --max-steps is 100.
For each task this picks the attempt published in odysseys/results/<task_id>/verdict.json (matched
by startedAt) and writes <out-dir>/<task_id>/steps.jsonl with one row per model call: the call's
action, its reasoning as the response, and that call's screenshot from trajectory/.
"""
import glob, json, os, shutil, sys

shards, out = sys.argv[1], sys.argv[2]
published = {}
for path in glob.glob(os.path.join(os.path.dirname(__file__), "..", "odysseys", "results", "*", "verdict.json")):
    verdict = json.load(open(path))
    published[verdict["taskId"]] = verdict.get("startedAt")

attempts = {}
for state_path in glob.glob(os.path.join(shards, "**", "run-state.json"), recursive=True):
    for result in json.load(open(state_path))["results"]:
        attempts.setdefault(result["taskId"], []).append((result.get("startedAt"), os.path.dirname(state_path)))

shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
written = 0
for task_id, started in published.items():
    base = next((b for s, b in attempts.get(task_id, []) if s == started), None)
    task_dir = base and os.path.join(base, f"task{task_id}")
    if not task_dir or not os.path.exists(os.path.join(task_dir, "result.json")):
        continue  # no gradable result: the scorer never sees it, and it counts as a failure
    history = json.load(open(os.path.join(task_dir, "result.json")))["action_history"]
    run_dir = os.path.join(out, task_id)
    os.makedirs(run_dir)
    with open(os.path.join(run_dir, "steps.jsonl"), "w") as f:
        for i, step in enumerate(history):
            shot = os.path.join(task_dir, "trajectory", f"{i:04d}.png")
            f.write(json.dumps({"step_num": i + 1, "screenshot": shot if os.path.exists(shot) else "",
                                "response": step.get("thought") or "", "action": step.get("action") or "",
                                "final": i == len(history) - 1}) + "\n")
    open(os.path.join(run_dir, "result.txt"), "w").write("1\n")
    written += 1
print(f"{written} run folders from {len(published)} published tasks")
