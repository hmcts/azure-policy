#!/bin/bash
# Convenience wrapper for running the policy-governance Inspec profile locally.
#
# This repo does not vendor Ruby/Inspec. Install Inspec once (any recent
# Chef Inspec 4.x/5.x release works; see README.md "Local policy tests with
# Inspec" for details), then use this script instead of remembering the
# repo_root input and --chef-license flag every time.
#
# Usage:
#   ./test/inspec/run.sh                              # run every control against this repo
#   ./test/inspec/run.sh --controls policy-definition-tagging
#   ./test/inspec/run.sh --input repo_root=test/fixtures --controls policy-definition-good_policy
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROFILE_DIR="${SCRIPT_DIR}/policy-governance"

exec inspec exec "${PROFILE_DIR}" \
  --input repo_root="${REPO_ROOT}" \
  --chef-license accept-no-persist \
  --reporter cli \
  "$@"
