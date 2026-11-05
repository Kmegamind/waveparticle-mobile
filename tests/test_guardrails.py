"""Tests for .claude/hooks/guardrails.py, run against throwaway git repos."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "..", ".claude", "hooks", "guardrails.py")


def git(path, *args):
    subprocess.run(["git", "-C", path, *args], check=True, capture_output=True)


class GuardrailTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = self.tmp.name
        git(self.repo, "init", "-q", "-b", "main")
        git(self.repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q",
            "--allow-empty", "-m", "init")
        self.config({"test": "true", "deploy_patterns": [r"\bvercel\b.*--prod"]})

    def tearDown(self):
        self.tmp.cleanup()

    def config(self, data):
        os.makedirs(os.path.join(self.repo, ".claude"), exist_ok=True)
        with open(os.path.join(self.repo, ".claude", "guardrails.json"), "w") as f:
            json.dump(data, f)

    def hook(self, tool, tool_input, cwd=None):
        payload = {"tool_name": tool, "tool_input": tool_input, "cwd": cwd or self.repo}
        env = dict(os.environ, CLAUDE_PROJECT_DIR=self.repo)
        out = subprocess.run([sys.executable, "-I", HOOK], input=json.dumps(payload),
                             capture_output=True, text=True, env=env, check=True)
        if not out.stdout.strip():
            return None
        return json.loads(out.stdout)["hookSpecificOutput"]

    def bash(self, command, cwd=None):
        return self.hook("Bash", {"command": command}, cwd)

    def assertDenied(self, result, text=""):
        self.assertIsNotNone(result)
        self.assertEqual(result["permissionDecision"], "deny")
        self.assertIn(text, result["permissionDecisionReason"])

    # secrets
    def test_reading_env_denied_but_example_allowed(self):
        self.assertDenied(self.hook("Read", {"file_path": f"{self.repo}/.env"}), "secrets")
        self.assertDenied(self.hook("Read", {"file_path": f"{self.repo}/.env.local"}))
        self.assertDenied(self.hook("Read", {"file_path": f"{self.repo}/secrets/key.pem"}))
        self.assertIsNone(self.hook("Read", {"file_path": f"{self.repo}/.env.example"}))

    def test_printing_env_in_shell_denied(self):
        self.assertDenied(self.bash("cat .env"))
        self.assertIsNone(self.bash("cat .env.example"))

    # rule files
    def test_editing_rules_denied_reading_allowed(self):
        self.assertDenied(self.hook("Edit", {"file_path": f"{self.repo}/AGENTS.md"}), "own rules")
        self.assertDenied(self.hook("Write", {"file_path": f"{self.repo}/.claude/settings.json"}))
        self.assertIsNone(self.hook("Read", {"file_path": f"{self.repo}/AGENTS.md"}))
        self.assertIsNone(self.hook("Edit", {"file_path": f"{self.repo}/src/app.py"}))

    # git
    def test_commit_on_main_denied_in_all_forms(self):
        self.assertDenied(self.bash('git commit -m "x"'), "no commits on main")
        self.assertDenied(self.bash("git add . && git commit -m x"))
        self.assertDenied(self.bash(f"cd {self.repo} && git commit -m x", cwd="/"))
        self.assertDenied(self.bash(f"git -C {self.repo} commit -m x", cwd="/"))

    def test_commit_on_feature_branch_allowed(self):
        git(self.repo, "switch", "-q", "-c", "feat/1-x")
        self.assertIsNone(self.bash("git commit -m x"))

    def test_push_to_main_denied(self):
        git(self.repo, "switch", "-q", "-c", "feat/1-x")
        self.assertDenied(self.bash("git push origin main"))
        self.assertDenied(self.bash("git push origin HEAD:main"))
        self.assertDenied(self.bash("git push -f origin +feat/1-x:master"))
        self.assertIsNone(self.bash("git push -u origin feat/1-x"))

    def test_bare_push_on_main_denied(self):
        self.assertDenied(self.bash("git push"))

    # gh
    def test_pr_merge_denied(self):
        self.assertDenied(self.bash("gh pr merge 12 --squash"), "don't merge")
        self.assertDenied(self.bash("~/.local/bin/gh api repos/o/r/pulls/1/merge -X PUT"))

    def test_pr_create_runs_tests(self):
        self.assertIsNone(self.bash("gh pr create --fill"))
        self.config({"test": "exit 1"})
        self.assertDenied(self.bash("gh pr create --fill"), "tests failed")

    # deploy
    def test_deploy_needs_human(self):
        result = self.bash("npx vercel deploy --prod")
        self.assertEqual(result["permissionDecision"], "ask")
        self.assertIsNone(self.bash("npx vercel dev"))

    def test_unrelated_commands_allowed(self):
        self.assertIsNone(self.bash("ls -la"))
        self.assertIsNone(self.bash("git status"))
        self.assertIsNone(self.bash("echo 'git commit'"))


if __name__ == "__main__":
    unittest.main()
