#!/bin/bash
# Utilities for working with existing Azure Policy assignments in this repo.
#
# Usage:
#   ./pipeline-scripts/policy-assignment-tools.sh check-compliance <name-substring> [name-substring...]
#   ./pipeline-scripts/policy-assignment-tools.sh fix-display-name <name-substring> <subscription-id>
#
# Examples:
#   ./pipeline-scripts/policy-assignment-tools.sh check-compliance aad_admin_groups use_managed_identities workload_identity
#   ./pipeline-scripts/policy-assignment-tools.sh fix-display-name aad_admin_groups 8a07fdcd-6abd-48b3-ad88-ff737a4b9e3c
#
# check-compliance requires `az login` with at least Reader access on the
# assignment scopes being checked. It reads the most recent policy
# evaluation via `az policy state summarize` — it does not trigger a new
# scan (see README.md/Inspec harness for other validation options).
#
# fix-display-name only rewrites the local assign.*.json file; it does not
# call Azure. The updated file is applied to Azure the normal way, via the
# manage-azure-policy.yml GitHub Actions workflow on merge to master.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ASSIGNMENTS_DIR="${REPO_ROOT}/assignments"

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: required command '${cmd}' not found on PATH" >&2
    exit 1
  fi
}

# Finds assignment files whose filename contains the given substring,
# e.g. "aad_admin_groups" matches assign.aks.aad_admin_groups.json
# anywhere under assignments/mgmt-groups/** or assignments/subscriptions/**.
find_assignment_files() {
  local name_substring="$1"
  find "${ASSIGNMENTS_DIR}" -type f \
    \( -name "assign.*${name_substring}*.json" -o -name "builtin.assign.*${name_substring}*.json" \) \
    | sort
}

# Translates an assignment's `properties.scope` ARM resource ID into the
# scope arguments expected by `az policy state summarize`, which has no
# generic `--scope` flag - it takes `--subscription`, `--resource-group`,
# and/or `--management-group` instead. Prints one arg per line for the
# caller to read into an array; returns non-zero for unsupported scopes.
scope_to_az_args() {
  local scope="$1"
  # Tolerate a trailing slash (some assignment JSON files store scope with
  # one, e.g. "/subscriptions/<id>/").
  scope="${scope%/}"
  if [[ "${scope}" =~ ^/subscriptions/([^/]+)/resourceGroups/([^/]+)$ ]]; then
    echo "--subscription"
    echo "${BASH_REMATCH[1]}"
    echo "--resource-group"
    echo "${BASH_REMATCH[2]}"
  elif [[ "${scope}" =~ ^/subscriptions/([^/]+)$ ]]; then
    echo "--subscription"
    echo "${BASH_REMATCH[1]}"
  elif [[ "${scope}" =~ ^/providers/Microsoft\.Management/managementGroups/([^/]+)$ ]]; then
    echo "--management-group"
    echo "${BASH_REMATCH[1]}"
  else
    return 1
  fi
}

# --- check-compliance ------------------------------------------------------
#
# For every assignment file matching any of the given name substrings,
# queries the most recent Azure Policy evaluation for that assignment's
# scope and reports whether it currently has 0 non-compliant resources.
# Exits non-zero if any matched assignment has non-compliant resources, so
# this can be used as a pass/fail gate.
check_compliance() {
  if [ "$#" -eq 0 ]; then
    echo "ERROR: check-compliance requires at least one name substring" >&2
    exit 1
  fi

  require_command az
  require_command jq

  local overall_status=0
  local matched_any=false

  local name_substring
  for name_substring in "$@"; do
    local files
    files="$(find_assignment_files "${name_substring}")"

    if [ -z "${files}" ]; then
      echo "WARN: no assignment files matched '*${name_substring}*'" >&2
      continue
    fi

    local file
    while IFS= read -r file; do
      matched_any=true

      local assignment_name scope
      assignment_name="$(jq -r '.name' "${file}")"
      scope="$(jq -r '.properties.scope' "${file}")"

      if [ -z "${assignment_name}" ] || [ "${assignment_name}" = "null" ] \
        || [ -z "${scope}" ] || [ "${scope}" = "null" ]; then
        echo "FAIL  ${file}: missing 'name' or 'properties.scope', cannot check compliance"
        overall_status=1
        continue
      fi

      echo ""
      echo "## Checking ${assignment_name} at scope ${scope} (${file})"

      local scope_args_raw
      if ! scope_args_raw="$(scope_to_az_args "${scope}")"; then
        echo "FAIL  ${assignment_name} (${scope}): unrecognized scope format, cannot map to az CLI arguments"
        overall_status=1
        continue
      fi
      local scope_args=()
      while IFS= read -r scope_arg; do
        scope_args+=("${scope_arg}")
      done <<< "${scope_args_raw}"

      local summary non_compliant
      if ! summary="$(az policy state summarize \
        --policy-assignment "${assignment_name}" \
        "${scope_args[@]}" \
        --output json 2>&1)"; then
        echo "FAIL  ${assignment_name} (${scope}): unable to query policy state - ${summary}"
        overall_status=1
        continue
      fi

      non_compliant="$(echo "${summary}" \
        | jq -r '[.results.policyAssignments[]?.results.nonCompliantResources // 0] | add // 0')"

      if [ "${non_compliant}" -eq 0 ] 2>/dev/null; then
        echo "PASS  ${assignment_name} (${scope}): 0 non-compliant resources"
      else
        echo "FAIL  ${assignment_name} (${scope}): ${non_compliant} non-compliant resource(s)"
        overall_status=1
      fi
    done <<< "${files}"
  done

  if [ "${matched_any}" = false ]; then
    echo "ERROR: no assignment files matched any of the given name substrings: $*" >&2
    exit 1
  fi

  exit "${overall_status}"
}

# --- fix-display-name --------------------------------------------------------
#
# Looks up the real display name of a subscription via Azure CLI and
# rewrites the parenthetical suffix of the matching assignment's
# properties.displayName to match it, e.g.:
#   "AKS AAD Admin Groups (OldName)" -> "AKS AAD Admin Groups (RealSubName)"
#
# Only the local assign.*.json file is modified; nothing is pushed to Azure.
fix_display_name() {
  local name_substring="${1:-}"
  local subscription_id="${2:-}"

  if [ -z "${name_substring}" ] || [ -z "${subscription_id}" ]; then
    echo "ERROR: fix-display-name requires <name-substring> <subscription-id>" >&2
    exit 1
  fi

  require_command az
  require_command jq

  local sub_dir="${ASSIGNMENTS_DIR}/subscriptions/${subscription_id}"
  if [ ! -d "${sub_dir}" ]; then
    echo "ERROR: no assignments directory found for subscription '${subscription_id}' (expected ${sub_dir})" >&2
    exit 1
  fi

  local files
  files="$(find "${sub_dir}" -maxdepth 1 -type f \
    \( -name "assign.*${name_substring}*.json" -o -name "builtin.assign.*${name_substring}*.json" \) \
    | sort)"

  if [ -z "${files}" ]; then
    echo "ERROR: no assignment file matched '*${name_substring}*' under ${sub_dir}" >&2
    exit 1
  fi

  local match_count
  match_count="$(echo "${files}" | wc -l | tr -d ' ')"
  if [ "${match_count}" -gt 1 ]; then
    echo "ERROR: name substring '${name_substring}' matched multiple files under ${sub_dir}, expected exactly one:" >&2
    echo "${files}" >&2
    exit 1
  fi

  local file="${files}"

  local real_sub_name
  if ! real_sub_name="$(az account show --subscription "${subscription_id}" --query name -o tsv 2>&1)"; then
    echo "ERROR: unable to look up subscription '${subscription_id}' via az account show - ${real_sub_name}" >&2
    exit 1
  fi

  local current_display_name
  current_display_name="$(jq -r '.properties.displayName' "${file}")"

  if [ -z "${current_display_name}" ] || [ "${current_display_name}" = "null" ]; then
    echo "ERROR: ${file} has no properties.displayName to fix" >&2
    exit 1
  fi

  local base_name new_display_name
  if [[ "${current_display_name}" =~ ^(.*)\ \([^\)]*\)$ ]]; then
    base_name="${BASH_REMATCH[1]}"
  else
    base_name="${current_display_name}"
  fi
  new_display_name="${base_name} (${real_sub_name})"

  if [ "${current_display_name}" = "${new_display_name}" ]; then
    echo "OK    ${file}: displayName already matches '${real_sub_name}', no change needed"
    return 0
  fi

  local tmp_file
  tmp_file="$(mktemp)"
  jq --arg new_name "${new_display_name}" '.properties.displayName = $new_name' "${file}" > "${tmp_file}"
  mv "${tmp_file}" "${file}"

  echo "FIXED ${file}: '${current_display_name}' -> '${new_display_name}'"
}

usage() {
  cat <<'EOF'
Usage:
  policy-assignment-tools.sh check-compliance <name-substring> [name-substring...]
  policy-assignment-tools.sh fix-display-name <name-substring> <subscription-id>
EOF
}

main() {
  local command="${1:-}"
  [ "$#" -gt 0 ] && shift

  case "${command}" in
    check-compliance)
      check_compliance "$@"
      ;;
    fix-display-name)
      fix_display_name "$@"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
