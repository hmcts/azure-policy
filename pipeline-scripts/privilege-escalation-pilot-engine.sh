#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
GO_BINARY=${GO_BINARY:-go}
SOURCE_SHA256=8d49585365c26e809754850b4119b0f97eaba608071b1c99bc3e68b41038272e
TEMPORARY=$(mktemp -d "${TMPDIR:-/tmp}/dtspo35033-engine.XXXXXX")
trap 'rm -rf "$TEMPORARY"' EXIT

curl --fail --silent --show-error --location --max-time 120 \
  https://codeload.github.com/open-policy-agent/gatekeeper/tar.gz/refs/tags/v3.23.1 \
  --output "$TEMPORARY/gatekeeper.tar.gz"
printf '%s  %s\n' "$SOURCE_SHA256" "$TEMPORARY/gatekeeper.tar.gz" | shasum -a 256 --check
mkdir "$TEMPORARY/source"
tar -xzf "$TEMPORARY/gatekeeper.tar.gz" --strip-components=1 -C "$TEMPORARY/source"

cd "$TEMPORARY/source"
POLICY_REPO_ROOT="$ROOT" GOTOOLCHAIN=local "$GO_BINARY" test -count=1 -json \
  "$ROOT/pipeline-scripts/privilege-escalation-pilot-engine_test.go"