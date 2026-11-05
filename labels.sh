#!/usr/bin/env bash
# Create the course label set in the current GitHub repo. Safe to re-run (--force updates).
set -e
gh label create "type:story"      --color 1D76DB --force
gh label create "type:task"       --color 5319E7 --force
gh label create "type:bug"        --color D73A4A --force
gh label create "priority:must"   --color B60205 --force
gh label create "priority:should" --color FBCA04 --force
gh label create "priority:could"  --color C5DEF5 --force
gh label create "size:S"          --color C2E0C6 --force
gh label create "size:M"          --color 7BCB8C --force
gh label create "size:L"          --color 0E8A16 --force
gh label create "in-progress"     --color 0052CC --force
