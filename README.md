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

### DTSPO-35033: Scoped privilege-escalation enforcement

These are proposed Deny assignments on
`daniel-christou/dtspo-35033-scoped-deny`. They have not been deployed.
Publishing this branch does not authorise a PR or deployment.
Do not open a PR, run a deployment workflow or create test resources without
separate approval. The existing HMCTS `AKSNotAllowConEsc` assignment
stays in Audit. No application manifests, policy definitions or workflows change.

Each new `builtin.assign.aks.not_allow_con_esc.*.json` assignment uses the
existing built-in definition `1c6e92c9-99f0-4e55-9cf2-0c234dc48f99`.
It intersects one resource group, one namespace and the exact stable selector
of one ticket-fixed controller. There are five assignments per demo cluster
and one for the PTLSBOX Jenkins controller. There is no namespace-wide Deny.

#### Target inventory

Read-only Azure inventory on 30 October 2026 confirmed one AKS cluster in
each resource group below. Recheck this before deployment and after any
resource-group or controller-label change. A new matching workload or cluster
in the same resource group would also be covered.

| Cluster | Subscription | Resource group |
| --- | --- | --- |
| `cft-demo-00-aks` | `d025fece-ce99-4df2-b7a9-b649d3ff2060` | `cft-demo-00-rg` |
| `cft-demo-01-aks` | `d025fece-ce99-4df2-b7a9-b649d3ff2060` | `cft-demo-01-rg` |
| `ss-ptlsbox-00-aks` | `64b1c6d6-1481-44ad-b620-d8fe26a2c768` | `ss-ptlsbox-00-rg` |

The following rows apply separately to both demo resource groups.
Assignment names use `NoEscD0` for demo00 and `NoEscD1` for demo01.
All selector entries in a row must match.

| Assignment suffix | Namespace | Controller | Pod selector | Ticket PR |
| --- | --- | --- | --- | --- |
| `Mailhog` | `money-claims` | Deployment `mailhog` | `app=mailhog` | cnp-flux-config #48627 |
| `Intdemo` | `ccd` | StatefulSet `ccd-logstash-intdemo-logstash` | `app=ccd-logstash-intdemo-logstash`, `release=ccd-logstash-intdemo` | cnp-flux-config #48296, #48633 |
| `Ccd` | `ccd` | StatefulSet `ccd-logstash-logstash` | `app=ccd-logstash-logstash`, `release=ccd-logstash` | cnp-flux-config #47758 |
| `Pman` | `ccd` | StatefulSet `ccd-logstash-probateman-logstash` | `app=ccd-logstash-probateman-logstash`, `release=ccd-logstash-probateman` | cnp-flux-config #47758 |
| `Sptribs` | `sptribs` | StatefulSet `sptribs-logstash-logstash` | `app=sptribs-logstash-logstash`, `release=sptribs-logstash` | cnp-flux-config #47758 |

`NoEscPtlsJenkins` selects only the StatefulSet `jenkins` in namespace
`jenkins` on PTLSBOX. Its selector is
`app.kubernetes.io/component=jenkins-controller` AND
`app.kubernetes.io/instance=jenkins` (sds-flux-config #9088).
Agents, other Jenkins environments, other Logstash releases, production,
and shared-chart preview consumers are not selected. Jake's shared-CCD
release/testing handoff is still required before adding preview consumers.

All containers in selected pods are evaluated, including init, injected and
ephemeral containers. These drafts retain the parent's namespace and
Dynatrace image exceptions. They keep `source=Original` and
`forcePrivilegeEscalationToBeFalse=false`. Missing escalation fields therefore
keep the existing UID-dependent behaviour. The parent's a360 `notScopes`
lie outside these resource groups and are not copied into the narrower files.
Labels are a scope filter, not an immutable security boundary. Changing a
controller's selector can leave its pods under the parent Audit rule only.

#### Validation and deferred rollout

Read-only checks on 30 October confirmed the live parent effect is Audit and
the built-in definition is version 8.0.0 with namespace/label filtering.
The exact parent-linked constraint was `dryrun` on all three clusters.
Demo00's audit at 15:53:04 UTC and demo01's at 15:52:29 UTC each exposed
all 34 findings, with none for the selected ticket workloads. PTLSBOX's audit
at 15:50:44 UTC reported zero findings. These are Audit observations, not
proof of Deny admission or rollback. Existing application evidence remains
separate from this local policy proposal.

Local validation passed for all 11 JSON drafts and 121 pairwise scope/selector
checks. A subsequent read-only membership check matched exactly five pods on
each demo cluster and one PTLSBOX controller pod. All matched pods were Ready,
had zero restarts and had false escalation flags on every regular, init and
injected container. Their selectors matched their owning controllers.
The rules excluded 1,153 other pods on demo00, 1,028 on demo01 and 94 on
PTLSBOX at the time of the check. These counts are a snapshot, not an admission
test or a guarantee against future selector changes.

Local checks must parse all 11 JSON files, check identities and short unique
names, preserve parent exceptions, and test namespace/selector isolation.
Recheck selected live pods and controller selectors using read-only queries.
Use the existing static `policy-assignment-tools.sh check-remediation-text`
operation and `git diff --check`. Do not run deployment scripts to validate
these drafts.

Before any later publication, get platform and workload-owner approval.
Prove positive, negative and non-target admission plus rollback in an isolated
sandbox fixture first. Reject explicit escalation in a main or init container
and admit the compliant control. Inspect actual pod admission and controller
events, not only successful Job or Deployment creation. Do not send email,
run Logstash ingestion or force application restarts for this policy test.

The PR sandbox generator processes only the CFTAPPS-SBOX subscription directory.
It does not deploy these demo or PTLSBOX drafts. It also rewrites input scopes
to the whole sandbox subscription and adds `_Sandbox` to assignment names.
Use a separately reviewed, fixture-only namespace and selector for sandbox
testing. Do not copy these workload selectors there as a test shortcut.
Do not hand-edit generated output or assume a draft PR prevents deployment.

The files describe the intended final Deny state. Before the first actual
workload rollout, stage only approved pilot assignments in Audit and confirm
their live membership, then promote demo00 to Deny in a controlled change.
Observe actual admission, workload health and policy synchronisation before
any separate demo01 or PTLSBOX promotion. Recheck that unrelated findings
remain outside the new assignments. No wider rollout is implied.

#### Rollback

Set only the affected new assignment's effect back to Audit. Keep the parent
Audit assignment, workload fixes and existing exceptions unchanged.
Each exact assignment ID is recorded in its JSON file. Also inventory any
generated `_Sandbox` or duplicate assignments before rollback.
Verify the matching live constraint no longer denies, then verify admission
and workload recovery. Add-on propagation is asynchronous, so a successful
pipeline alone is not rollback proof. Do not disable Gatekeeper or add a
namespace-wide bypass. Do not assume deleting a JSON file or closing a PR
removes the Azure assignment. Confirm cleanup by exact ID and use an approved
targeted removal if needed. No remediation task is required for Audit/Deny.

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
