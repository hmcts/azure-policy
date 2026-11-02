# azure-policy

## What is this for?

This repo stores azure policy definitions and assignments.

## Overview of Azure Policy Definitions

In Azure Policy, definitions describe resource compliance conditions and the effect to take if a condition is met.

Policy definitions are written in JSON.

## Overview of Azure Policy Assignments

Policy assignments are used by Azure Policy to define which resources are assigned which policy definitions.

Policies assignments must have a scope over which they take effect and this scope can be either a subscription or a management group.

## Azure's built-in policy definitions

In the Azure portal, browse to Policy, then definitions.  Search for the required definition, then select it.  The Definition ID will be displayed.

For example

`/providers/Microsoft.Authorization/policyDefinitions/59efceea-0c96-497e-a4a1-4eb2290dac15`

This can then be used as the policyDefinitionId in your assignment assign.mynewpolicy.json file

## How to create a new policy definition

Create a new sub-directory under `policies` and name it for the purpose of the policy e.g. tagging.

Create a policy definition json file in the new sub-directory. It should be named `policy.json`.

## How to create a new policy assignment

Policies that are to be assigned to a management group are located within the appropriate management group directory under `assignments/mgmt-groups`.

Policies that are to be assigned to a subscription or group of subscriptions are located within the appropriate subscription directory under `assignments/subscriptions`.

When you've decided on a scope, create a policy assignment file in the appropriate directory. Name the file assign.policyname.json e.g. `assign.diagnostics.json`.

## What scope should I choose?

Use a subscription scope when you are testing out a policy or if you only want a policy to apply to a single subscription or group of subscriptions.

When testing policy assignments against Sandbox, if the policy you are assigning is a built in Azure policy make sure to prefix the policy file with `builtin.assign.*`
so that the policy definition id is not overriden like it is done for custom policies, you can view how this works in sandbox-override.sh

Use a management group scope when you want a policy to apply to all subscriptions in the tenant.

The AKS Disable Automount API Credentials policy is assigned per subscription under `assignments/subscriptions`, rather than at the HMCTS management group. Maintain namespace exclusions in each subscription's assignment; new AKS subscriptions need their own assignment.

The automount policy uses `Deny`, except for `DCD-CFTAPPS-DEV`, `DCD-CFTAPPS-PROD`, and `DTS-SHAREDSERVICES-PROD`, which remain on `Audit`.

Do not set `nonComplianceMessages` on these assignments: Azure does not support this property for the `Microsoft.Kubernetes.Data` policy mode.

### DTSPO-35033: Management-group privilege-escalation policy

This proposal follows the request to use the existing HMCTS management-group
assignment `AKSNotAllowConEsc`, not separate workload-scoped Deny assignments.
It adds two OneAgent image exceptions and keeps the effect in Audit.
The 11 scoped assignments from the earlier proposal are removed.
No application manifests, policy definitions or deployment workflows change.
Publishing the proposal does not deploy the management-group assignment.

#### OneAgent exceptions

The added `excludedImages` entries are limited to the two observed repositories:

- `yrk32651.live.dynatrace.com/linux/oneagent:*` for nonproduction.
- `ebe20728.live.dynatrace.com/linux/oneagent:*` for production.

Read-only checks on 2 November 2026 correlated these images with regular
container `dynatrace-oneagent` in namespace `dynatrace`, owned by DaemonSet
`dynakube-oneagent`. Both used tag `1.347.72-raw`, omitted
`allowPrivilegeEscalation` and set container `runAsUser` to 1000.
The repository-specific patterns allow tag changes without excluding other
Dynatrace repositories or the whole namespace. They are image-based exceptions,
not owner checks: any container using a matching image is excluded.

Keep the existing operator image exceptions, five namespace exclusions and two
a360 resource-group exclusions unchanged. Keep enforcement mode Default and
built-in definition `1c6e92c9-99f0-4e55-9cf2-0c234dc48f99` unchanged.
Its observed version was 8.0.0. Do not change the default `source=Original` or
`forcePrivilegeEscalationToBeFalse=false` behaviour in this change.

#### Compliance evidence and blockers

Read-only checks on 2 November 2026, 14:58-15:22 UTC, reconciled all 66 HMCTS
subscriptions with Resource Graph. They found 30 AKS clusters and no Azure Arc
connected clusters. Two AKS clusters were already excluded by `notScopes`.
All 28 in-scope clusters had exact-assignment policy-state records:
21 NonCompliant and 7 Compliant. These are dated observations, not a deployment
readiness guarantee. OneAgent was not the only source of violations.

| Other workload | Clusters | Observed violation |
| --- | --- | --- |
| Jenkins controller and init container | `cft-ptl-00-aks`, `cft-ptlsbox-00-aks`, `ss-ptl-00-aks` | Both explicitly set `allowPrivilegeEscalation=true` |
| Mail-relay Fluent Bit and Exim exporter sidecars | `ss-dev-00-aks`, `ss-prod-00-aks`, `ss-prod-01-aks` | Flag omitted with inherited pod UID 100 |
| Preview Logstash, JDBC download init containers and Elasticsearch | `cft-preview-00-aks` | Flag omitted with container or inherited pod UID 1000 |

The other findings need workload-owner remediation, not broader exclusions.
Jake's shared-CCD preview testing and release handoff remains separate.
The historically fixed `ss-ptlsbox-00-aks` Jenkins controller remained compliant.

Exact-assignment Gatekeeper constraints were readable on 26 of 28 clusters.
All 26 used `dryrun` and retained the expected parameters. Direct checks on
`ss-sbox-00-aks` and `cft-sbox-00-aks` were blocked by obsolete endpoints in
the existing kubeconfig. Azure reported both Compliant, but direct verification
still needs current approved access. No credentials or kubeconfig were refreshed.

Preview's last inspected audit at 15:03:10 UTC exposed 500 of 509 container
findings. An independent current pod check at 15:22:45 UTC found 551 matching
container findings, including 390 outside OneAgent. These snapshots are not
atomic and workloads were changing. Do not treat capped samples, absent rows or
old audit results as proof that all workloads comply.

#### Validation and staged rollout

Local validation must parse the assignment, prove that only the two image
entries were added, and check positive and negative image-matching fixtures.
Preserve the exact assignment identity, Audit effect and existing exclusions.
Confirm that the net PR contains no new scoped assignments. Run `git diff --check`.

The PR sandbox generator does not process management-group assignments.
A successful sandbox job does not deploy or test this assignment.
Do not change the generator or hand-edit generated output for this proposal.

1. Review and deploy the exception-only change through the approved repository
    workflow while the management-group assignment remains in Audit.
2. Verify propagation to the exact assignment-linked constraints. Refresh the
    full in-scope inventory and compliance records. Resolve the other findings,
    stale access and preview sample/reporting limitations before claiming
    every in-scope cluster is compliant.
3. Only after that gate passes, raise a separate reviewed change from Audit to
    Deny on this same management-group assignment. Preserve all other settings.
4. Verify effective constraints, approved positive/negative admission tests,
    controller events and workload health. Existing pods are not evicted, but
    replacement pods can be blocked. Do not force production restarts to test.

Policy synchronisation and reporting are asynchronous. Allow for propagation
and check fresh timestamps. Do not trigger scans, remediation tasks or test
workloads without separate approval. No remediation task is needed for Audit/Deny.

#### Rollback

For an unexpected issue with these exceptions, revert only the two added image
entries and keep Audit. For a later approved Deny rollout, restore the exact
management-group assignment's effect to Audit through the approved workflow.
Verify actual constraint propagation and admission recovery, not only pipeline
success. Do not disable Gatekeeper or add namespace-wide bypasses.
Removing the scoped proposal files does not remove any live Azure
assignments. If such assignments are found, inventory their exact IDs and use
an approved targeted cleanup rather than assuming repository deletion is enough.

**If a tagging policy exception is required, please use the notScopes in assignments/mgmt-groups/mg-HMCTS/assign.tagging.json**

## How to add a new subscription

Create a new directory named for the subscription id under the `assignments/subscriptions` directory.

Azure policy requires the subscription id and does not recognise friendly names.

## Naming conventions for policies

When applying policies to multiple subscription scopes, you should append the displayName, id and name of the policy assignment with the displayName of the subscription.

This will make it easier to identify the policy assignment at a glance in the Azure Portal.

Example:

```json
    "displayName": "HMCTS Keyvault Security Activity Logging - DCD-CFT-Sandbox",
    "id": "/subscriptions/bf308a5c-0624-4334-8ff8-8dca9fd43783/providers/Microsoft.Authorization/policyAssignments/HMCTSKeyVault_DCD-CFT-Sandbox",
    "name": "HMCTSKeyVault_DCD-CFT-Sandbox"
```

When applying a policy to the management group scope, you can leave the displayName without a suffix but make sure to set the id and name to `Global`

Example:

```json
    "displayName": "HMCTS Collect Activity Logs",
    "id": "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyAssignments/HMCTSDiagnosticGlobal",
    "name": "HMCTSDiagnosticGlobal"
```

## How to test a policy definition

### Deployment

**Management Group Scopes**
To test a policy definition, create a new policy assignment json file under `assignments/mg-cft-sandbox`.  This management group contains 3 subscriptions which your test policy will be applied to. [Azure Portal Link](https://portal.azure.com/#view/Microsoft_Azure_Resources/ManagmentGroupDrilldownMenuBlade/~/overview/tenantId/531ff96d-0ae9-462a-8d2d-bec7c0b42082/mgId/CFT-Sandbox/mgDisplayName/CFT%20-%20Sandbox/mgCanAddOrMoveSubscription~/true/mgParentAccessLevel/Owner/drillDownMode~/true/defaultMenuItemId/subscriptions/showDirectChildSubscriptionsOnly~/false)

**Subscription Scopes**
You can also test the policy assignment on a subscription assignment json file under `assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb'.

This is the `DCD-CFTAPPS-SBOX` subscription which can be used for the purpose of testing that new policy definitions are using valid json and have the expected values before live rollout.

**Github Actions**
Creating a pull request will trigger a GitHub action that will create your policy definition and assign it to this subscription.  **ONLY** policy definitions in the above folders *assignments/mg-cft-sandbox* or *assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb* will be processed.  All other folders containing policy definitions will be ignored by the PR GitHub action. So if your resource isn't contained by either of these scopes, you need to select a new resource for testing or create one within the scope.

The policy definition and assignment will be appended by GitHub action, with `- CFT-Sandbox` making them, easily identifiable in the Azure Portal.

Example:

```json
    "displayName": "HMCTS Restricted VM SKU Sizes - (mg:CFT-Sandbox)"
    "scope": "/providers/Microsoft.Management/managementGroups/CFT-Sandbox"
    "id": "/providers/Microsoft.Management/managementGroups/CFT-Sandbox/providers/Microsoft.Authorization/policyAssignments/HMCTSVmSkuSize-Sbox"
```

### Operation

At this point, you will have a definition assigned to the `DCD-CFTAPPS-SBOX` subscription. In order to test that your policy has the desired effect, a compliance scan must be run.

This should take place automatically when the assignment is created. You should be able to see what resources are non-compliant and confirm that the resources listed are expected.

In order to see if the policy will work in practice, a manual remediation task must be ran. This can be done by clicking on the assignment and clicking `Create remediation task`

You can do this for your `- Sandbox` policy assignment from above.

If you want to test on an additional subscription, create another assignment json file under `assignments/subscriptions/bf308a5c-0624-4334-8ff8-8dca9fd43783`. This is the `DCD-CFT-Sandbox` subscription.

If everything is working as expected, submit a new PR with assignments for all the other subscriptions you are targeting resources in.

If your policy should take effect over all subscriptions after testing, remove the subscription specific assignments and create an assignment json file under the mgmt-groups folder. Ensure that that the policy 'id' and assignment 'policyDefinitionId' match.

Notice, there is a 24 characters limit on the policy name.

Example:

```json
    "displayName": "HMCTS Restricted VM SKU Sizes - (HMCTS MG)"
    "scope": "/providers/Microsoft.Management/managementGroups/HMCTS"
    "id": "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyAssignments/HMCTSVmSkuSize"
```

### Policy permissions

Policies that use the deployIfNotExists action should have a list of roleDefinitionIds defined. These are required to remediate non-compliant resources. These permissions must be granted to some sort of identity.

Currently, we use a User Assigned Managed Identity (UAMI) with such policy assignments.

The reason for using a User Assigned instead of a System Assigned Managed Identity is that we can assign the appropriate permissions via code instead of doing this manually.

At the time of writing, `deployIfNotExists` actions require permissions to be manually assigned when being deployed via the manage-azure-policy GitHub action. See [here](https://docs.microsoft.com/en-gb/azure/governance/policy/how-to/remediate-resources#how-remediation-security-works)

The policies in HMCTS that are using the `deployIfNotExists` action are focused on ensuring diagnostic logging is in place for our Azure estate e.g. sending subscription level activity logs to an Azure Event Hub for consumption by Splunk.

There are two UAMIs currently in use for this:

- `soc-sbox-eventhub-azure-policy`
- `soc-prod-eventhub-azure-policy`

To enable diagnostic logging on PaaS, the following roles are required:

| Role | Scope |
|---|---|
| Log Analytics Contributor | Subscription or management group containing resources to be remediated |
| Monitoring Contributor | Subscription or management group containing resources to be remediated |

The identity must also have the Microsoft.EventHub/namespaces/authorizationRules/listkeys/action permission. This is available in the Azure Event Hubs Data Owner role.

The `soc-sbox-eventhub-azure-policy` identity has Log Analytics Contributor and Monitoring Contributor over the DCD-CFTAPPS-SBOX and DCD-CFT-Sandbox subscriptions that are to be used for testing purposes. It also has the Azure Event Hubs Data Owner role over the Azure Event Hubs Namespace soc-prod-xsiam-eventhubns.

The `soc-prod-eventhub-azure-policy` identity has Log Analytics Contributor and Monitoring Contributor over the HMCTS management group. It also has the Azure Event Hubs Data Owner role over the Azure Event Hubs Namespace soc-prod-xsiam-eventhubns.

These roles and permissions should be sufficient for your needs, however, if you need to add extra subscription scopes to the `soc-sbox-eventhub-azure-policy` identity for the purposes of testing, you can update the [terraform code](https://github.com/hmcts/soc/blob/master/modules/eventhub/roles.tf).

You should not need to grant additional permissions to the `soc-prod-eventhub-azure-policy` identity

Policies that do not use the `deployIfNotExists` action, e.g. our tagging policies, do not require permissions since they are simply evaluating resources.

### Policy Structure

You can find more detail on the structure of a `Policy`, `Initiative` or `Assignment` in the following [Azure Policy](https://docs.microsoft.com/en-gb/azure/governance/policy/) documentation:

- [Definition Structure](https://docs.microsoft.com/en-gb/azure/governance/policy/concepts/definition-structure)
- [Initiative Structure](https://docs.microsoft.com/en-gb/azure/governance/policy/concepts/initiative-definition-structure)
- [Assignment structure](https://docs.microsoft.com/en-gb/azure/governance/policy/concepts/assignment-structure)

### Workflow permissions

A [custom role](https://github.com/hmcts/azure-custom-roles) was created for the workflow, it's basically a copy of the `Resource Policy Contributor` built in role with a few extra permissions to list Management Groups and Subscriptions.

### Rotating Azure Credentials

The AZURE_CREDENTIALS GitHub repo secret stores the **clientId**, **clientSecret**, **subscriptionId** and **tenantId** in a JSON object.

You may be required to rotate the **clientSecret** value which can be done as follows:

- Run `az login` and sign in with your Azure account.
- Run `az ad sp create-for-rbac --name azure-policy-manager --json-auth`. This will create a new Service Principal secret in Azure and print out a JSON object containing the updated **clientSecret** value.
- Copy the JSON object(You only need the 4 values from above) and paste this into the AZURE_CREDENTIALS GitHub secret.
- Save and test the GitHub workflow.

## Pipeline - GH Workflows

### manage-azure-policy.yml

Triggers: push to master, any pull_request, or manual workflow_dispatch. Three independent jobs:

1. apply-azure-policy-sandbox (PRs only) Logs into Azure, runs sandbox-override.sh to generate retargeted copies of `policies/`, and assignments under `Sandbox/` (pointed at a test subscription),
deploys just those via azure/manage-azure-policy, then kicks off an async compliance scan on that sandbox subscription. Lets a PR be validated live without touching production.

2. apply-azure-policy-subscription (push to master only) Deploys real policies/ and assignments/subscriptions/ (matching assign..json / builtin.assign..json) straight to their live subscription scopes.

3. apply-azure-policy-mgmt-group (push to master only)
   
- Deploys policies/ and assignments/mgmt-groups/ to the HMCTS management group.
- Then queries all subscriptions nested under HMCTS (via az account management-group show --expand), filters to Enabled/Past Due ones (explicitly skipping one hardcoded dev subscription), and collects their IDs.
- Kicks off an async policy-compliance scan across all those subscriptions so compliance data reflects the just-deployed policy changes.
   All three jobs use azure/manage-azure-policy@v0 in mode: complete (i.e. it reconciles state — removing definitions/assignments no longer present in the given paths, not just adding new ones).

### pipeline scripts

**pipeline-scripts/sandbox-override.sh** 

It's a PR-time build step that takes the repo's real policy definitions and subscription-level assignments and rewrites copies of them into a Sandbox/ folder, retargeted at a test subscription ($SUB), 
so a pull request can be validated against a live sandbox environment without touching production policies/assignments.

**pipeline-scripts/policy-assignment-tools.sh**

Utilities for working with existing Azure Policy assignments in this repo.

## Troubleshooting

### Applying Policies

#### 1. Github Action completes successfully but nothing happens

- Pull requests (PR) only apply to the *Testing* Sandbox scopes
- Merge will apply to all the other scopes

Check the assignments folder location which contains your assign.mypolicy.json file. Is it the correct scope?

#### 2. Github Action Error, Stage "Sandbox - Test creating and updating Azure Polices"

An error occured while creating policy assignment.

> Error: The policy assignment create request is invalid. The policy definition '/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/providers/Microsoft. Authorization/policyDefinitions/HMCTSAUMSandbox' could not be found.*

Check the assignment assign.mypolicy.json file and confirm that scope and ID match.

Subscriptions Scopes

```json
    "scope": "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb"
    "id": "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/providers/Microsoft.Authorization/policyAssignments/...
```

OR

Management Group Scopes

```json
    "scope": "/providers/Microsoft.Management/managementGroups/HMCTS"
    "id": "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyAssignments/HMCTSaum_scan"
```

Also the assignment folder target scope is the same as what has been described in the scope and ID.

Alternatively this issue can be caused by the `policies/mypolicies/policy.json` definition failing to create when a duplicate `"displayName": "Configure periodic checking..."` has been used. Was a built-in Azure copied?

#### 3. Github Action Error, Stage "Sandbox - Test creating and updating Azure Polices"

Error: The request content was invalid and could not be deserialized: 'Could not find member 'enforcementMode' on object of type 'PolicyDefinitionProperties'. Path 'properties.enforcementMode', line 15, position 22.'.

Open the scope used by the assignment assign.mynewpolicy.json file and confirm that

```json
    "type": "Microsoft.Authorization/policyAssignments",
    "id": "/providers/Microsoft.Management/managementGroups/Platform-Sandbox/providers/Microsoft.Authorization/policyAssignments/...",
```

Are correct.

#### 4. Github Action Error, Stage "Sandbox - Test creating and updating Azure Polices"

An error occured while creating policy assignment. Error: The requested operation on resource 'Microsoft.Management/managementGroups/CFT-Sandbox/providers/Microsoft.Authorization/policyAssignments/HMCTSaum_scan' failed since identity is unavailable for location ''.

Open the scope used by the assignment assign.mynewpolicy.json file and confirm that

```json
    "location": "uksouth",
```

#### 5. Github Action Error, Stage "Sandbox - Test creating and updating Azure Polices"

An error occured while creating policy assignment. Error: The policy assignment  'HMCTSaum_scan' request is invalid. Policy assignments must include a 'managed identity' when assigning 'Modify' policy definitions. Please see [documentation](https://aka.ms/azurepolicyremediation) for usage information.

Open the scope used by the assignment assign.mynewpolicy.json file and confirm that

```json
"identity": {
        "type": "UserAssigned",
        "userAssignedIdentities": {
            "/subscriptions/2307d175-7e49-434b-9ac2-515529b845f2/resourceGroups/soc-core-infra-sbox-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/soc-sbox-eventhub-azure-policy": {}
        }
    },
```

Or for PROD

```json
"identity": {
        "type": "UserAssigned",
        "userAssignedIdentities": {
            "/subscriptions/8ae5b3b6-0b12-4888-b894-4cec33c92292/resourceGroups/soc-core-infra-prod-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/soc-prod-eventhub-azure-policy": {}
        }
    },
```
