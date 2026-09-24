#!/bin/bash
# Utilities for working with existing Azure Policy assignments in this repo.
#
# Usage:
#   ./pipeline-scripts/policy-assignment-tools.sh check-compliance <name-substring> [name-substring...]
#   ./pipeline-scripts/policy-assignment-tools.sh check-compliance --environment <name> <name-substring> [name-substring...]
#   ./pipeline-scripts/policy-assignment-tools.sh check-remediation-text <name-substring> [name-substring...]
#   ./pipeline-scripts/policy-assignment-tools.sh fix-display-name <name-substring> <subscription-id>
#
# Examples:
#   ./pipeline-scripts/policy-assignment-tools.sh check-compliance aad_admin_groups use_managed_identities workload_identity
#   ./pipeline-scripts/policy-assignment-tools.sh check-compliance --environment Sandbox restrict_host_path_volume_paths
#   ./pipeline-scripts/policy-assignment-tools.sh check-remediation-text aad_admin_groups use_managed_identities
#   ./pipeline-scripts/policy-assignment-tools.sh fix-display-name aad_admin_groups 8a07fdcd-6abd-48b3-ad88-ff737a4b9e3c
#
# check-compliance requires `az login` with at least Reader access on the
# assignment scopes being checked. It reads the most recent policy
# evaluation via `az policy state summarize` — it does not trigger a new
# scan (see README.md/Inspec harness for other validation options).
#
# check-compliance's optional `--environment <name>` flag accounts for
# assignments deployed via pipeline-scripts/sandbox-override.sh, which
# appends "_<ENVIRONMENT>" to the assignment name and rebuilds `id` from
# scope + that new name before deploying the sandbox copy (it does not keep
# the file's original `.id`). Without this flag, check-compliance queries
# the assignment name/id exactly as they appear in the local file, which
# only matches assignments deployed straight from that file (e.g. via the
# live subscription/management-group jobs, not the sandbox job).
#
# --environment only affects subscription-scoped assignment files that live
# directly under assignments/subscriptions/<sandbox-subscription-id>/ - the
# only directory pipeline-scripts/sandbox-override.sh actually redeploys
# from (`find ./assignments/$SUB -name 'assign.*.json'`). For those files,
# check-compliance also flattens the queried scope to that bare sandbox
# subscription (dropping any resource group), since sandbox-override.sh
# unconditionally overwrites `properties.scope` with the sandbox
# subscription ID before deploying - the sandbox copy is always
# subscription-scoped, even if the source file is resource-group-scoped.
# A subscription-scoped file living under a *different* subscription's
# directory is never redeployed with a suffix at all, so --environment
# rejects it explicitly (FAIL) instead of silently querying a scope/id that
# was never deployed.
#
# sandbox-override.sh's rename/rebuild logic for management-group-scoped
# assignments is currently disabled, so assignments under
# assignments/mgmt-groups/** are never deployed with a suffix -
# check-compliance always queries those using their unsuffixed name/id/scope,
# even when --environment is passed.
#
# check-remediation-text is purely local/static (no `az` calls): it checks
# that each matched assignment's properties.metadata.remediation is present,
# non-empty, and free of placeholder markers (TODO/TBD/FIXME).
#
# fix-display-name only rewrites the local assign.*.json file; it does not
# call Azure. The updated file is applied to Azure the normal way, via the
# manage-azure-policy.yml GitHub Actions workflow on merge to master.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Overridable so tests can point at a fixture directory instead of the
# repo's real assignments/.
ASSIGNMENTS_DIR="${ASSIGNMENTS_DIR:-${REPO_ROOT}/assignments}"
# Subscription that pipeline-scripts/sandbox-override.sh actually deploys
# sandbox copies into - the "SUB" value hardcoded for the
# apply-azure-policy-sandbox job in .github/workflows/manage-azure-policy.yml.
# Overridable so tests can point at a fixture subscription id instead.
SANDBOX_SUBSCRIPTION_ID="${SANDBOX_SUBSCRIPTION_ID:-b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb}"

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

# True if the given `properties.scope` is subscription-scoped (with or
# without a resource group). Used to limit sandbox-override.sh's
# "_<ENVIRONMENT>" suffix handling to the only assignments it actually
# applies to: sandbox-override.sh's MGMT_ASSIGNMENTS block (which would
# rename management-group-scoped assignments) is commented out, so
# management-group assignments are never deployed with a suffix.
is_subscription_scope() {
  local scope="${1%/}"
  [[ "${scope}" =~ ^/subscriptions/([^/]+)(/resourceGroups/([^/]+))?$ ]]
}

# True if the given assignment file lives directly under
# assignments/subscriptions/<SANDBOX_SUBSCRIPTION_ID>/ - the only directory
# pipeline-scripts/sandbox-override.sh actually reads assignments from
# (`find ./assignments/$SUB -name 'assign.*.json'`, where $SUB is the
# sandbox subscription's SUB env value). A file living anywhere else - e.g.
# under a different subscription's directory - is never redeployed with a
# "_<ENVIRONMENT>" suffix, no matter what its own `properties.scope` says.
is_under_sandbox_subscription_dir() {
  local file="$1"
  local sandbox_dir
  sandbox_dir="$(cd "${ASSIGNMENTS_DIR}/subscriptions/${SANDBOX_SUBSCRIPTION_ID}" 2>/dev/null && pwd)"
  if [ -z "${sandbox_dir}" ]; then
    return 1
  fi
  local file_dir
  file_dir="$(cd "$(dirname "${file}")" && pwd)"
  [ "${file_dir}" = "${sandbox_dir}" ]
}

# --- check-compliance ------------------------------------------------------
#
# For every assignment file matching any of the given name substrings,
# queries the most recent Azure Policy evaluation for that assignment's
# scope and reports whether it currently has 0 non-compliant resources.
# Exits non-zero if any matched assignment has non-compliant resources, so
# this can be used as a pass/fail gate.
#
check_compliance() {
  local environment=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --environment)
        environment="${2:-}"
        if [ -z "${environment}" ]; then
          echo "ERROR: --environment requires a value" >&2
          exit 1
        fi
        shift 2
        ;;
      *)
        break
        ;;
    esac
  done

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

      # sandbox-override.sh appends "_<ENVIRONMENT>" to sandbox assignment names
      # and rebuilds the deployed ID from scope + name; it also overwrites
      # properties.scope with the sandbox subscription ID. Match that here for
      # subscription-scoped files only.
      #
      # --environment applies only to files under
      # assignments/subscriptions/${SANDBOX_SUBSCRIPTION_ID}/; other
      # subscription-scoped files are rejected, and MG assignments stay unsuffixed.
      local apply_environment_suffix=false
      local effective_scope="${scope}"
      if [ -n "${environment}" ] && is_subscription_scope "${scope}"; then
        if ! is_under_sandbox_subscription_dir "${file}"; then
          echo "FAIL  ${file}: --environment ${environment} does not apply - this file is not under assignments/subscriptions/${SANDBOX_SUBSCRIPTION_ID}/, so pipeline-scripts/sandbox-override.sh never redeploys it with a '_${environment}' suffix; rerun without --environment to check its real deployed scope/id"
          overall_status=1
          continue
        fi
        apply_environment_suffix=true
        assignment_name="${assignment_name}_${environment}"
        effective_scope="/subscriptions/${SANDBOX_SUBSCRIPTION_ID}"
      fi

      echo ""
      echo "## Checking ${assignment_name} at scope ${effective_scope} (${file})"

      local scope_args_raw
      if ! scope_args_raw="$(scope_to_az_args "${effective_scope}")"; then
        echo "FAIL  ${assignment_name} (${effective_scope}): unrecognized scope format, cannot map to az CLI arguments"
        overall_status=1
        continue
      fi
      local scope_args=()
      while IFS= read -r scope_arg; do
        scope_args+=("${scope_arg}")
      done <<< "${scope_args_raw}"

      # Prefer the file's explicit `.id` (the assignment's full, unique
      # resource ID); fall back to constructing it from scope + name for
      # files that don't carry an `.id` field. When --environment applies to
      # this file (subscription-scoped, see above), always rebuild from
      # effective_scope + suffixed name instead, since that's what
      # sandbox-override.sh actually deploys. Azure returns
      # `policyAssignmentId` lower-cased in Policy Insights responses, so
      # lower-case here to ensure the OData comparison matches.
      local assignment_id
      if [ "${apply_environment_suffix}" = true ]; then
        assignment_id="${effective_scope%/}/providers/Microsoft.Authorization/policyAssignments/${assignment_name}"
      else
        assignment_id="$(jq -r '.id // empty' "${file}")"
        if [ -z "${assignment_id}" ]; then
          assignment_id="${effective_scope%/}/providers/Microsoft.Authorization/policyAssignments/${assignment_name}"
        fi
      fi
      assignment_id="$(echo "${assignment_id}" | tr '[:upper:]' '[:lower:]')"

      # OData string literals escape a single quote by doubling it.
      local assignment_id_odata="${assignment_id//\'/\'\'}"

      local summary matched_assignments non_compliant
      if ! summary="$(az policy state summarize \
        --filter "PolicyAssignmentId eq '${assignment_id_odata}'" \
        "${scope_args[@]}" \
        --output json 2>&1)"; then
        echo "FAIL  ${assignment_name} (${effective_scope}): unable to query policy state - ${summary}"
        overall_status=1
        continue
      fi

      # An empty/null `policyAssignments` array means the given assignment ID
      # doesn't actually resolve to a live assignment at this scope (e.g. the
      # file's `name`/`properties.scope`/`id` no longer matches what's
      # deployed in Azure). Treat that as "unable to verify" rather than a
      # false PASS - otherwise a stale/incorrect assignment file silently
      # reports 0 non-compliant resources even though the assignment (and
      # its real violations) were never actually queried.
      matched_assignments="$(echo "${summary}" \
        | jq -r '.policyAssignments // [] | length')"

      if [ "${matched_assignments}" -eq 0 ] 2>/dev/null; then
        echo "FAIL  ${assignment_name} (${effective_scope}): no matching policy assignment found in Azure for this id/scope (${assignment_id}) - the file's 'name', 'properties.scope', or 'id' likely no longer matches what is deployed; verify with 'az policy assignment show --name \"${assignment_name}\"' before trusting this result"
        overall_status=1
        continue
      fi

      non_compliant="$(echo "${summary}" | jq -r '.results.nonCompliantResources // 0')"

      if [ "${non_compliant}" -eq 0 ] 2>/dev/null; then
        echo "PASS  ${assignment_name} (${effective_scope}): 0 non-compliant resources"
      else
        echo "FAIL  ${assignment_name} (${effective_scope}): ${non_compliant} non-compliant resource(s)"
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

# --- check-remediation-text -------------------------------------------------
#
# For every assignment file matching any of the given name substrings,
# checks that properties.metadata.remediation is present, non-empty, and
# free of placeholder markers (TODO/TBD/FIXME). Purely local/static - does
# not call Azure. Exits non-zero if any matched assignment fails, so this
# can be used as a pass/fail gate.
check_remediation_text() {
  if [ "$#" -eq 0 ]; then
    echo "ERROR: check-remediation-text requires at least one name substring" >&2
    exit 1
  fi

  require_command jq

  local overall_status=0
  local matched_any=false
  local name_substring

  for name_substring in "$@"; do
    local files
    files="$(find_assignment_files "${name_substring}")"
    echo "## Checking remediation text for assignments matching '*${name_substring}*'"
    if [ -z "${files}" ]; then
      echo "WARN: no assignment files matched '*${name_substring}*'" >&2
      continue
    fi

    local file
    while IFS= read -r file; do
      matched_any=true

      local remediation
      remediation="$(jq -r '.properties.metadata.remediation // ""' "${file}")"

      if [ -z "${remediation}" ] || [ "${remediation}" = "null" ]; then
        echo "FAIL  ${file}: properties.metadata.remediation is missing or empty"
        overall_status=1
        continue
      fi

      if echo "${remediation}" | grep -Eiq '\b(todo|tbd|fixme)\b'; then
        echo "FAIL  ${file}: remediation text contains a placeholder marker - \"${remediation}\""
        overall_status=1
        continue
      fi

      echo "PASS  ${file}: \"${remediation}\""
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
  policy-assignment-tools.sh check-compliance --environment <name> <name-substring> [name-substring...]
      (--environment only affects subscription-scoped assignment files under
      assignments/subscriptions/<sandbox-subscription-id>/, flattening their
      queried scope to that bare subscription; files elsewhere are rejected
      explicitly, and management-group-scoped assignments are always
      checked unsuffixed, since sandbox-override.sh never renames them)
  policy-assignment-tools.sh check-remediation-text <name-substring> [name-substring...]
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
    check-remediation-text)
      check_remediation_text "$@"
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
