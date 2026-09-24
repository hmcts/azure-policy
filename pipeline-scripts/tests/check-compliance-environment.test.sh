#!/bin/bash
# Tests that `check-compliance --environment <name>` accounts for the
# "_<ENVIRONMENT>" suffix that pipeline-scripts/sandbox-override.sh applies
# to assignment names/ids when it deploys a copy into a sandbox subscription
# (this.name = this.name + "_" + ENVIRONMENT; this.id rebuilt from that name).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${SCRIPT_DIR}/../policy-assignment-tools.sh"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "${TEST_DIR}"' EXIT

mkdir -p "${TEST_DIR}/bin" \
  "${TEST_DIR}/assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb" \
  "${TEST_DIR}/assignments/subscriptions/8a07fdcd-6abd-48b3-ad88-ff737a4b9e3c" \
  "${TEST_DIR}/assignments/mgmt-groups/mg-HMCTS"

cat > "${TEST_DIR}/assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/builtin.assign.aks.restrict_host_path_volume_paths.json" <<'EOF'
{
  "properties": {
    "scope": "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb"
  },
  "id": "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/providers/Microsoft.Authorization/policyAssignments/AKSLimitHostPathVolPaths-cftsbox",
  "name": "AKSLimitHostPathVolPaths-cftsbox"
}
EOF

# sandbox-override.sh's MGMT_ASSIGNMENTS loop is commented out - management
# group scoped assignments are never redeployed with a "_<ENVIRONMENT>"
# suffix, so --environment must not apply to this file.
cat > "${TEST_DIR}/assignments/mgmt-groups/mg-HMCTS/assign.aks.restrict_host_path_volume_paths.json" <<'EOF'
{
  "properties": {
    "scope": "/providers/Microsoft.Management/managementGroups/HMCTS"
  },
  "id": "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyAssignments/AKSLimitHostPathVolPaths",
  "name": "AKSLimitHostPathVolPaths"
}
EOF

# sandbox-override.sh always overwrites `properties.scope` with the bare
# sandbox subscription ID (this.properties.scope=process.env.SUB), even for
# source files whose scope includes a resource group. --environment must
# query the flattened subscription-only scope/id that is actually deployed,
# not the resource-group-scoped one recorded in this file.
cat > "${TEST_DIR}/assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/assign.rg_scoped_test_policy.json" <<'EOF'
{
  "properties": {
    "scope": "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/resourceGroups/some-rg"
  },
  "id": "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/resourceGroups/some-rg/providers/Microsoft.Authorization/policyAssignments/RgScopedTestPolicy",
  "name": "RgScopedTestPolicy"
}
EOF

# sandbox-override.sh only ever redeploys files found under
# ./assignments/$SUB (the sandbox subscription's own directory). A file
# living under a different subscription's directory is never touched by it,
# so --environment must reject it explicitly rather than silently querying
# a scope/id that was never deployed.
cat > "${TEST_DIR}/assignments/subscriptions/8a07fdcd-6abd-48b3-ad88-ff737a4b9e3c/assign.other_sub_test_policy.json" <<'EOF'
{
  "properties": {
    "scope": "/subscriptions/8a07fdcd-6abd-48b3-ad88-ff737a4b9e3c"
  },
  "id": "/subscriptions/8a07fdcd-6abd-48b3-ad88-ff737a4b9e3c/providers/Microsoft.Authorization/policyAssignments/OtherSubTestPolicy",
  "name": "OtherSubTestPolicy"
}
EOF

# Stub `az`: records the filter argument it was called with, and only
# reports a matching (compliant) assignment when the filter's assignment id
# carries the "_sandbox" suffix - i.e. what sandbox-override.sh actually
# deploys. This proves --environment Sandbox drives the tool to query the
# suffixed id, not the raw file id.
cat > "${TEST_DIR}/bin/az" <<EOF
#!/bin/bash
args="\$*"
echo "\${args}" >> "${TEST_DIR}/az-calls"
if [[ "\${args}" == *"policyassignments/akslimithostpathvolpaths-cftsbox_sandbox'"* ]]; then
  echo '{"policyAssignments": [{"policyAssignmentId": "x"}], "results": {"nonCompliantResources": 0}}'
elif [[ "\${args}" == *"policyassignments/akslimithostpathvolpaths'"* ]]; then
  echo '{"policyAssignments": [{"policyAssignmentId": "x"}], "results": {"nonCompliantResources": 0}}'
elif [[ "\${args}" == *"policyassignments/rgscopedtestpolicy_sandbox'"* ]]; then
  echo '{"policyAssignments": [{"policyAssignmentId": "x"}], "results": {"nonCompliantResources": 0}}'
else
  echo '{"policyAssignments": [], "results": {"nonCompliantResources": 0}}'
fi
exit 0
EOF
chmod +x "${TEST_DIR}/bin/az"

cat > "${TEST_DIR}/bin/jq" <<EOF
#!/bin/bash
exec /usr/bin/jq "\$@"
EOF
chmod +x "${TEST_DIR}/bin/jq"

run_check_compliance() {
  ASSIGNMENTS_DIR="${TEST_DIR}/assignments" \
    PATH="${TEST_DIR}/bin:${PATH}" \
    "${SCRIPT}" check-compliance "$@"
}

set +e
output="$(run_check_compliance --environment Sandbox restrict_host_path_volume_paths 2>&1)"
status=$?
set -e

if [ "${status}" -ne 0 ]; then
  echo "FAIL: expected exit status 0 when --environment matches the deployed suffix, got ${status}" >&2
  echo "${output}" >&2
  exit 1
fi

if ! grep -Fq "akslimithostpathvolpaths-cftsbox_sandbox'" "${TEST_DIR}/az-calls"; then
  echo "FAIL: az was not queried with the '_sandbox' suffixed assignment id" >&2
  cat "${TEST_DIR}/az-calls" >&2
  exit 1
fi

if ! grep -Fq "PASS  AKSLimitHostPathVolPaths-cftsbox_Sandbox" <<< "${output}"; then
  echo "FAIL: expected PASS output for the suffixed assignment name" >&2
  echo "${output}" >&2
  exit 1
fi

echo "PASS: --environment Sandbox queries the '_Sandbox'-suffixed assignment id"

if grep -Fq "policyassignments/akslimithostpathvolpaths_sandbox'" "${TEST_DIR}/az-calls"; then
  echo "FAIL: --environment was incorrectly applied to a management-group-scoped assignment" >&2
  cat "${TEST_DIR}/az-calls" >&2
  exit 1
fi

if ! grep -Fq "PASS  AKSLimitHostPathVolPaths (" <<< "${output}"; then
  echo "FAIL: expected the management-group-scoped assignment to be queried unsuffixed and PASS" >&2
  echo "${output}" >&2
  exit 1
fi

echo "PASS: --environment Sandbox does not affect management-group-scoped assignments"

: > "${TEST_DIR}/az-calls"
set +e
output="$(run_check_compliance restrict_host_path_volume_paths 2>&1)"
status=$?
set -e

if [ "${status}" -ne 1 ]; then
  echo "FAIL: expected exit status 1 without --environment (unsuffixed id has no match), got ${status}" >&2
  echo "${output}" >&2
  exit 1
fi

if grep -Fq "_sandbox" "${TEST_DIR}/az-calls"; then
  echo "FAIL: default (no --environment) call unexpectedly queried a suffixed assignment id" >&2
  cat "${TEST_DIR}/az-calls" >&2
  exit 1
fi

echo "PASS: default behavior (no --environment) is unchanged"

: > "${TEST_DIR}/az-calls"
set +e
output="$(run_check_compliance --environment Sandbox rg_scoped_test_policy 2>&1)"
status=$?
set -e

if [ "${status}" -ne 0 ]; then
  echo "FAIL: expected exit status 0 for the RG-scoped sandbox file (flattened scope matches), got ${status}" >&2
  echo "${output}" >&2
  exit 1
fi

if grep -Fq "some-rg" "${TEST_DIR}/az-calls"; then
  echo "FAIL: az was queried with the resource-group-scoped args instead of the flattened subscription scope" >&2
  cat "${TEST_DIR}/az-calls" >&2
  exit 1
fi

if ! grep -Fq "subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/providers/microsoft.authorization/policyassignments/rgscopedtestpolicy_sandbox'" "${TEST_DIR}/az-calls"; then
  echo "FAIL: az was not queried with the flattened subscription-scoped, suffixed assignment id" >&2
  cat "${TEST_DIR}/az-calls" >&2
  exit 1
fi

echo "PASS: --environment Sandbox flattens a resource-group-scoped sandbox file to the deployed subscription-only scope/id"

: > "${TEST_DIR}/az-calls"
set +e
output="$(run_check_compliance --environment Sandbox other_sub_test_policy 2>&1)"
status=$?
set -e

if [ "${status}" -ne 1 ]; then
  echo "FAIL: expected exit status 1 for a file outside the sandbox subscription directory, got ${status}" >&2
  echo "${output}" >&2
  exit 1
fi

if [ -s "${TEST_DIR}/az-calls" ]; then
  echo "FAIL: az should not have been called for a file --environment cannot apply to" >&2
  cat "${TEST_DIR}/az-calls" >&2
  exit 1
fi

if ! grep -Fq "FAIL" <<< "${output}"; then
  echo "FAIL: expected an explicit rejection message for the out-of-scope file" >&2
  echo "${output}" >&2
  exit 1
fi

echo "PASS: --environment Sandbox explicitly rejects a file outside the sandbox subscription directory"
