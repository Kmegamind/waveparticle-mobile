#!/usr/bin/env python3
"""PreToolUse guardrails for Claude Code.

Deny:
  - reading or writing secret files (.env, .env.*, secrets/), except .env.example
  - editing the agent's own rules (AGENTS.md, CLAUDE.md, DESIGN.md, .claude/)
  - git commit / git push that would land on main or master
  - gh pr merge (a human merges)
  - gh pr create when the test command in .claude/guardrails.json fails
Ask (human confirms):
  - commands matching a deploy pattern in .claude/guardrails.json

Prints a PreToolUse decision to stdout; prints nothing to allow. Unexpected
errors allow the call (fail open) because CI is the backstop.
"""
import fnmatch
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED_BRANCHES = {"main", "master"}
RULE_FILES = ("AGENTS.md", "CLAUDE.md", "DESIGN.md")
TEST_TIMEOUT = 300


def decide(decision, reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def load_config(root):
    try:
        with open(os.path.join(root, ".claude", "guardrails.json")) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def is_secret(path):
    name = os.path.basename(path)
    if name == ".env.example":
        return False
    return (name == ".env" or fnmatch.fnmatch(name, ".env.*")
            or "/secrets/" in f"/{path}" or path.startswith("secrets/"))


def is_rule_file(path, root):
    rel = os.path.relpath(os.path.abspath(path), root) if os.path.isabs(path) else path
    return rel in RULE_FILES or rel.startswith(".claude" + os.sep) or rel == ".claude"


def check_file_tool(tool, tool_input, root):
    path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not path:
        return
    if is_secret(path):
        decide("deny", f"Guardrail: {path} may hold secrets. Use .env.example for variable names.")
    if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit") and is_rule_file(path, root):
        decide("deny", f"Guardrail: agents don't edit their own rules ({path}). "
                       "Propose the change to the human instead.")


def segments(command):
    for part in re.split(r"&&|\|\||[;|\n]", command):
        try:
            tokens = shlex.split(part)
        except ValueError:
            tokens = part.split()
        if tokens:
            yield tokens


def repo_dir(command, cwd):
    m = re.match(r"\s*cd\s+(\"[^\"]+\"|'[^']+'|\S+)\s*(&&|;)", command)
    if m:
        path = os.path.expanduser(m.group(1).strip("\"'"))
        return path if os.path.isabs(path) else os.path.join(cwd, path)
    return cwd


def current_branch(path):
    try:
        out = subprocess.run(["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"],
                             capture_output=True, text=True, timeout=10, check=False)
        return out.stdout.strip() if out.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def check_git(tokens, base):
    if os.path.basename(tokens[0]) != "git":
        return
    i, override = 1, None
    while i < len(tokens) and tokens[i].startswith("-"):
        if tokens[i] == "-C" and i + 1 < len(tokens):
            override, i = tokens[i + 1], i + 2
        elif tokens[i] in ("-c", "--git-dir", "--work-tree") and i + 1 < len(tokens):
            i += 2
        else:
            i += 1
    if i >= len(tokens):
        return
    sub, rest = tokens[i], tokens[i + 1:]
    path = os.path.join(base, override) if override else base
    if sub == "commit" and current_branch(path) in PROTECTED_BRANCHES:
        decide("deny", "Guardrail: no commits on main. Create a branch first: "
                       "git switch -c feat/<issue#>-<slug>")
    if sub == "push":
        refs = [a for a in rest if not a.startswith("-")]
        targets = [r.split(":")[-1].lstrip("+") for r in refs[1:]]
        if any(t in PROTECTED_BRANCHES or t.endswith(("/main", "/master")) for t in targets):
            decide("deny", "Guardrail: no pushes to main. Push your branch and open a PR.")
        if len(refs) <= 1 and current_branch(path) in PROTECTED_BRANCHES:
            decide("deny", "Guardrail: you are on main; this push would update it. "
                           "Push your branch and open a PR.")


def check_secrets_in_command(tokens):
    for t in tokens[1:]:
        if not t.startswith("-") and is_secret(t):
            decide("deny", f"Guardrail: {t} may hold secrets; don't read or print it.")


def check_gh(tokens, base, config):
    if os.path.basename(tokens[0]) != "gh":
        return
    args = [t for t in tokens[1:] if not t.startswith("-")]
    if args[:2] == ["pr", "merge"] or (args[:1] == ["api"] and any(a.endswith("/merge") for a in args)):
        decide("deny", "Guardrail: agents don't merge PRs. Leave it for a human to review and merge.")
    if args[:2] == ["pr", "create"] and config.get("test"):
        try:
            out = subprocess.run(config["test"], shell=True, cwd=base, capture_output=True,
                                 text=True, timeout=TEST_TIMEOUT, check=False)
        except subprocess.TimeoutExpired:
            decide("deny", f"Guardrail: tests timed out ({config['test']}). Fix before opening a PR.")
        if out.returncode != 0:
            decide("deny", f"Guardrail: tests failed, PR not opened.\n$ {config['test']}\n"
                           f"{(out.stdout + out.stderr)[-1500:]}")


def check_deploy(command, config):
    for pattern in config.get("deploy_patterns", []):
        if re.search(pattern, command):
            decide("ask", "Guardrail: this looks like a deploy. A human must approve it.")


def main():
    payload = json.load(sys.stdin)
    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})
    cwd = payload.get("cwd") or os.getcwd()
    root = os.environ.get("CLAUDE_PROJECT_DIR") or cwd
    if tool != "Bash":
        check_file_tool(tool, tool_input, root)
        return
    command = tool_input.get("command", "")
    base = repo_dir(command, cwd)
    config = load_config(root)
    for tokens in segments(command):
        check_secrets_in_command(tokens)
        check_git(tokens, base)
        check_gh(tokens, base, config)
    check_deploy(command, config)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 - fail open by design; CI is the backstop
        sys.exit(0)
