# Privilege escalation pilot

## Safety and targeting contract

Keep the existing privilege-escalation validation assignment in Audit. Use one
central PR for the isolated pilot and intended preview rollout. Do not merge the
preview rollout before sandbox application and recovery acceptance. Global Deny
is a separate change.

## Agreed scope and minimum sandbox route

Daniel Wilson agreed to check other environments and preserve genuine exceptions.
The commitment was to test the custom policy and application behaviour in sandbox.
The disposable fixtures below are one implementation option, not an agreed
requirement. A dedicated end-to-end test pipeline is not required either.

Use the smallest representative sandbox test that can establish the following:

1. Compare the selected workloads with equivalents in other environments. Record
  genuine exceptions and any missing evidence. Do not infer a requirement for
  escalation from an Audit finding alone.
2. Verify the exact cluster, namespace, opt-in and selected images before policy
  activation. Check that the selected test workloads do not contain the known
  unsupported OS, privileged, capability or helper variants.
3. Use suitable existing sandbox workloads when authorised and safely targeted.
  Record a working baseline, then create approved replacement Pods to exercise
  admission. Check the admitted escalation flags, startup, normal component
  operations, logs and retained data where relevant.
4. Investigate failures before granting an exception. Confirm a usable recovery
  path. Disabling mutation does not change existing Pods or restore lost data.
5. Record the results before preview acceptance. Keep Audit unchanged and the
  combined PR unmerged until sandbox acceptance.

Group applications with equivalent images, startup and security configuration.
Test each distinct configuration rather than manually repeating identical tests
for every application. Review unique configurations and failures separately.

The current pilot selects only `dtspo-35033-mutation-pilot` and opted-in Pods.
Existing sandbox applications outside that scope will not be mutated. Do not
relabel their namespaces or imply they were tested. If no suitable workloads
exist within the approved scope, use representative disposable workloads or
review an explicit targeting change before deployment.

Do not require the fixture database, asset server, custom proof records, driver
staging or fixture-specific evidence CLI when the existing-workload route can
provide the necessary evidence. The detailed commands below apply only when
choosing the disposable-fixture route. They are not additional requirements for
every application. This procedure does not authorise deployment or restarts.

## Targeting limits

The mutation selects CREATE requests for original Pods by exact cluster,
namespace, container role and image tag. It does not repair existing Pods. Image
tags are not immutable digests. Record resolved image IDs for each test.

Preserve the five approved namespace exclusions and four Dynatrace image
patterns. The image-and-role selectors leave those vendor images and the
Elasticsearch `configure-sysctl` init helpers unselected. The two approved a360
resource groups are outside both selected clusters. These protections are
explicitly tested. They are not inherited from the Audit assignment.

A genuine workload exception can use
`hmcts.net/privilege-escalation-exception=approved`. This exempts the entire Pod,
not one container. The label records a review decision. It does not verify
approval, restrict who can set it, or exempt the Pod from the separate validator.
Do not add it merely because a workload appears in Audit findings.

Assign cannot inspect sibling OS, privileged or capability values with these
image selectors. It also cannot distinguish two init containers by both image
and name. The five unmarked adversarial variants in the engine tests are not
five observed genuine exceptions. They prove these automatic exclusions are
absent. Keep those tests and the risk visible. Do not activate preview while its
targeting gate fails. A passing fixture test does not resolve that design gap.

Before activation, compare a fresh target inventory with equivalents in other
environments. Compare image digest, role, startup command, UID, capabilities,
privileged flag, OS and injected helpers. Resolve new genuine exceptions before
admission. Do not treat inaccessible clusters as compliant. Runtime safety for
the proposed rollout must be supported by this comparison and the sandbox tests.

## Local design disposition

The saved cross-environment inventory covers 26 of 28 in-scope clusters. Its
selected targets are Linux, without privileged or SYS_ADMIN requests. All 96
selected curl init entries have the JDBC download name. These are historical
observations, not enforced restrictions or current application acceptance.

The strict tests still fail for unmarked Windows, privileged, SYS_ADMIN and
different-name curl variants in both stages. Sibling path tests cannot express
these guards. A name-only JDBC selector loses image protection and is rejected.
The explicit exception marker is supported but cannot enforce approval. None of
these alternatives resolves automatic exclusion safely within this payload.

These synthetic failures do not establish that the reviewed sandbox workloads
need exceptions. A bounded pilot requires the scope and workload checks above,
not an assertion that automatic exclusions have been implemented. Keep the
strict tests and their failures visible. Do not waive them or claim preview
readiness from a successful narrow pilot alone.

Opening a PR activates pilot assignments through the existing deployment
workflow, even if the separate focused test job fails. Do not treat that job as
a deployment gate. Confirm scope and authorisation before opening the PR.

## Optional fixture preparation

The fixture tool only reads local policy files and emits JSON or checks local
evidence. It does not run kubectl, access Azure, pull images or deploy resources.
Run these commands from the policy repository root:

```sh
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs --self-test
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs --list
```

Fixtures cover all eight image/role cohorts. Run one cohort at a time. They use
only `dtspo-35033-mutation-pilot`, private Services, default-deny network policies,
cohort-local communication and kube-dns. They do not use host mounts or privileged
sysctl helpers. Elasticsearch uses `node.store.allow_mmap=false` instead. Do not
widen network access to make a test pass. Stop and review unsupported DNS paths
or unexpected sidecar injection.

The main Elasticsearch and Logstash containers retain their image entrypoints.
The fixture profiles use a controlled UID, configuration and disposable data.
They are component tests, not copies of the application families. For application
acceptance, cover the distinct release configurations, including entrypoint,
UID, mounts and instrumentation. Suitable existing sandbox workloads can provide
that evidence. Do not connect disposable copies to business databases, indices,
credentials or integrations.

PVCs request `managed-csi` storage. A Logstash cohort requests three 4 GiB claims.
The fixtures can incur sandbox disk and compute costs when deployed. The namespace
quota limits the run, but does not authorise deployment or prove available capacity.
The support images default to `postgres:16.4` and `busybox:1.37.0`. Use approved
compatible mirrors through `DTSPO_PILOT_POSTGRES_IMAGE` and
`DTSPO_PILOT_TOOLS_IMAGE` if required. PostgreSQL uses trust authentication only
inside the isolated fixture network. Never expose it or use real data.

For Logstash and JDBC, obtain an approved PostgreSQL JDBC driver through the
normal artifact process. Verify its publisher checksum or signature. Record its
SHA256 in `DTSPO_JDBC_SHA256`. The fixture downloads it from its private asset
Service and checks that checksum. It does not download the driver from the internet.

```sh
set -euo pipefail
COHORT=LS924
COHORT_ID=$(printf '%s' "$COHORT" | tr '[:upper:]' '[:lower:]')
NAME="dtspo35033-${COHORT_ID}"
NS=dtspo-35033-mutation-pilot
EVIDENCE=$(mktemp -d)
export DTSPO_PILOT_RUN_ID=$(uuidgen)
: "${DTSPO_JDBC_SHA256:?Set the verified driver SHA256 for Logstash or JDBC}"
for PHASE in prepare baseline mutated recovery
do
  node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs \
    --cohort "$COHORT" --phase "$PHASE" > "$EVIDENCE/$PHASE.json"
done
```

For an Elasticsearch cohort, use its cohort name and omit the JDBC checksum
requirement. Rendered files contain no deployment commands. Review them first.

## Optional fixture deployment - authorised sandbox only

All commands below contact the cluster or change sandbox resources. Do not run
them during local-only preparation. Opening the combined PR also triggers actual
sandbox policy deployment through the existing workflow.

Confirm the selected context maps to the approved `cft-sbox-01-aks` cluster and
subscription. Use explicit `--context` on every command. Check capacity, approved
images, policy acceptance and managed Assign resources. If the namespace exists,
check its owner and contents. Stop if it is not the dedicated pilot namespace.
Never relabel another workload's namespace or reuse an existing business PVC.
Start with fresh, dedicated fixture claims.

```sh
: "${KUBE_CONTEXT:?Set and verify the cft-sbox-01-aks context}"
kubectl --context "$KUBE_CONTEXT" get namespace "$NS" -o json
kubectl --context "$KUBE_CONTEXT" apply -f "$EVIDENCE/prepare.json"
```

If the namespace does not yet exist, its absence is expected. Review and create it
only as part of the authorised fixture deployment. Do not suppress other errors.

For Logstash or JDBC, wait for the fixture asset StatefulSet. Stage only the
verified driver. This command does not authorise copying credentials or data.

```sh
kubectl --context "$KUBE_CONTEXT" -n "$NS" rollout status "statefulset/${NAME}-assets" --timeout=300s
kubectl --context "$KUBE_CONTEXT" -n "$NS" cp --no-preserve "$JDBC_JAR" "${NAME}-assets-0:/files/postgresql.jar" -c assets
kubectl --context "$KUBE_CONTEXT" -n "$NS" exec "${NAME}-assets-0" -c assets -- sha256sum /files/postgresql.jar
```

Compare the reported checksum with `DTSPO_JDBC_SHA256`. For Logstash only, wait
for PostgreSQL and insert the unique retention marker after initialisation.
The seed script never inserts this marker. An existing row means this is not a
fresh fixture run. Stop rather than overwrite it.

```sh
kubectl --context "$KUBE_CONTEXT" -n "$NS" rollout status "statefulset/${NAME}-pg" --timeout=300s
kubectl --context "$KUBE_CONTEXT" -n "$NS" exec "${NAME}-pg-0" -c postgres -- \
  psql -v ON_ERROR_STOP=1 -U postgres -d pilot -c \
  "INSERT INTO pilot_retention (id, token) VALUES (1, '$DTSPO_PILOT_RUN_ID');"
```

The marker is a UUID generated above, not arbitrary SQL input. Record the claim
UIDs and resolved volume names before the baseline, and compare them after each
phase. Do not delete claims between phases.

## Baseline and mutated phases

Baseline target Pods do not have the pilot opt-in label. Mutated target Pods have it. Both
manifests request `allowPrivilegeEscalation=true` for target entries. Only the
mutated admission result should change those entries to false.

Supporting asset and database StatefulSets remain identical across phases. Their
images are not selected, and their escalation flags are already false. Do not
restart or reseed the database between phases.

Run the following separately for `baseline` and `mutated`. Inspect initial
admission results before waiting for readiness. Save events and logs on failure.

```sh
PHASE=baseline
kubectl --context "$KUBE_CONTEXT" apply -f "$EVIDENCE/$PHASE.json"
kubectl --context "$KUBE_CONTEXT" -n "$NS" rollout status "statefulset/$NAME" --timeout=600s
kubectl --context "$KUBE_CONTEXT" -n "$NS" get pod "${NAME}-0" -o json > "$EVIDENCE/$PHASE-pod.json"
kubectl --context "$KUBE_CONTEXT" -n "$NS" get pvc -l "hmcts.net/pilot-cohort=$COHORT_ID" -o json > "$EVIDENCE/$PHASE-pvc.json"
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs \
  --check-pod "$EVIDENCE/$PHASE-pod.json" --cohort "$COHORT" --phase "$PHASE"
```

The Pod checker requires the exact fixture identity, volume references, container
shape, non-root security, namespace, phase, opt-in and flags. It checks Pod UIDs,
resolved image digests, successful init containers, readiness and no restarts.
It rejects host access, unknown volume sources and extra containers. An exception
marker cannot be used to pass the test. For each phase,
also inspect `NoNewPrivs` in the main process status and the complete Pod diff.
Investigate unexpected webhook changes rather than dismissing them as mutation.
For JDBC, check the init checksum log and the completed download. This alone is
not JDBC execution acceptance. The Logstash fixtures exercise the driver query.

For Elasticsearch or Logstash, inspect the main process, not only the shell
started by exec. Set `CONTAINER` to `elasticsearch` or `logstash`:

```sh
kubectl --context "$KUBE_CONTEXT" -n "$NS" exec "${NAME}-0" -c "$CONTAINER" -- \
  /bin/sh -ec 'grep "^NoNewPrivs:" /proc/1/status'
```

Require `NoNewPrivs: 1` for the mutated target. Record baseline and recovery values
and investigate differences. Do not infer this runtime result from the manifest.
For JDBC, the init-container log records its own process flag and checksum:

```sh
kubectl --context "$KUBE_CONTEXT" -n "$NS" logs "${NAME}-0" -c download-postgres-jdbc
```

For Logstash, wait for at least one scheduled query, then check the private file:

```sh
kubectl --context "$KUBE_CONTEXT" -n "$NS" exec "${NAME}-0" -c logstash -- \
  cat "/state/$PHASE.ndjson" > "$EVIDENCE/$PHASE-results.ndjson"
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs \
  --check-results "$EVIDENCE/$PHASE-results.ndjson" --cohort "$COHORT" --phase "$PHASE"
```

This verifies both record values, the phase and the retained database marker.
Scheduled duplicates are allowed. Missing records, stale phases and a recreated
database without the marker fail.

For Elasticsearch, use a separate terminal for the explicit private port-forward:

```sh
kubectl --context "$KUBE_CONTEXT" -n "$NS" port-forward "service/$NAME" 19200:9200
```

In baseline, create the private proof index and its first record:

```sh
curl --noproxy '*' --fail --show-error -X PUT http://127.0.0.1:19200/dtspo35033-proof \
  -H 'Content-Type: application/json' -d '{"settings":{"number_of_shards":1,"number_of_replicas":0}}'
curl --noproxy '*' --fail --show-error -X PUT 'http://127.0.0.1:19200/dtspo35033-proof/_doc/1?refresh=wait_for' \
  -H 'Content-Type: application/json' \
  -d "{\"message\":\"dtspo35033-one\",\"created_phase\":\"baseline\",\"run_id\":\"$DTSPO_PILOT_RUN_ID\"}"
```

After the mutated Pod starts, verify record 1 is still present before adding
record 2. Do not recreate the index or record 1. Reconnect port-forwarding if the
Pod rollout ended the old session.

```sh
curl --noproxy '*' --fail --show-error http://127.0.0.1:19200/dtspo35033-proof/_doc/1
curl --noproxy '*' --fail --show-error -X PUT 'http://127.0.0.1:19200/dtspo35033-proof/_doc/2?refresh=wait_for' \
  -H 'Content-Type: application/json' \
  -d "{\"message\":\"dtspo35033-two\",\"created_phase\":\"mutated\",\"run_id\":\"$DTSPO_PILOT_RUN_ID\"}"
```

In each phase, capture the search result and check it. Baseline expects record 1.
Mutated and recovery expect both original records with the same run identifier.

```sh
curl --noproxy '*' --fail --show-error 'http://127.0.0.1:19200/dtspo35033-proof/_search?size=10' > "$EVIDENCE/$PHASE-search.json"
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs \
  --check-results "$EVIDENCE/$PHASE-search.json" --cohort "$COHORT" --phase "$PHASE"
```

## Recovery and completion

Use the approved Azure Policy process to disable the eight pilot assignments
only. Logstash also matches the JDBC init mutation, so disabling just the main
image's assignment is insufficient. Leave preview assignments, global Audit,
managed webhooks and Gatekeeper configuration untouched. Pause PR deployment
updates during this exercise so they cannot re-enable the assignments.

Disabling is asynchronous. Observe removal or deactivation of the corresponding
managed Assign resources. Then deploy the rendered `recovery` phase and repeat
the Pod and data checks above with `PHASE=recovery`. Recovery retains the pilot
opt-in label and requests true. The admitted value must remain true after actual
disable propagation. Local tests only simulate that disabled-engine condition.

Existing mutated Pods do not revert automatically. The fixture StatefulSet update
creates replacement Pods while retaining the same claims. This is not permission
to restart, scale down or delete application controllers elsewhere. Disabling
mutation does not restore lost data. Do not reseed or reset storage to make a
recovery check pass.

After all three phases, check replacement Pod identity, unchanged image digests
and retained claim identities. A matching claim name alone does not prove that
the original PVC or bound volume survived.

```sh
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs --check-transition \
  "$EVIDENCE/baseline-pod.json" "$EVIDENCE/mutated-pod.json" "$EVIDENCE/recovery-pod.json" --cohort "$COHORT"
node pipeline-scripts/privilege-escalation-pilot-fixtures.mjs --check-storage \
  "$EVIDENCE/baseline-pvc.json" "$EVIDENCE/mutated-pvc.json" "$EVIDENCE/recovery-pvc.json" --cohort "$COHORT"
```

Record the commit, policy payloads, assignment state, manifest hashes, image IDs,
Pod and PVC UIDs, admission diffs, events, process flags, application results and
recovery evidence. Keep that evidence outside the repository. Review each real
application configuration as well as these component fixtures before preview
acceptance. Keep the same combined PR unmerged until acceptance.

Stop on unintended mutation, admission errors, restarts, lost data, unexpected
integration access or Gatekeeper degradation. Cleanup needs a separate check of
the exact fixture-owned objects and retained disks. Do not use blanket namespace,
controller or PVC deletion as an automatic cleanup or rollback step.