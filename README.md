# azure-policy

### What is this for?

This repo stores azure policy definitions and assignments.

### Overview of Azure Policy Defintions

In Azure Policy, definitions describe resource compliance conditions and the effect to take if a condition is met.

Policy definitions are written in JSON.

### Overview of Azure Policy Assignments

Policy assignments are used by Azure Policy to define which resources are assigned which policy definitions.

Policies assignments must have a scope over which they take effect and this scope can be either a subscription or a management group.

### How to create a new policy definition

Create a new sub-directory under `policies` and name it for the purpose of the policy e.g. tagging.

Create a policy definition json file in the new sub-directory. It should be named `policy.json`.

### How to create a new policy assignment

Policies that are to be assigned to a management group are located within the appropriate management group directory under `assignments/mgmt-groups`.

Policies that are to be assigned to a subscription or group of subscriptions are located within the appropriate subscription directory under `assignments/subscriptions`.

When you've decided on a scope, create a policy assignment file in the appropriate directory. Name the file assign.policyname.json e.g. `assign.tagging.json`.

### What scope should I choose?

Use a subscription scope when you are testing out a policy or if you only want a policy to apply to a single subscription or group of subscriptions.

Use a management groupo scope when you want a policy to apply to all subscriptions in the tenant.

### How to add a new subscription

Create a new directory named for the subscription id under the `assignments/subscriptions` directory.

Azure policy requires the subscription id and does not recognise friendly names.

### Naming conventions for policies

When applying policies to multiple subscription scopes, you should append the displayName, id and name of the policy assignment with the displayName of the subscription.

This will make it easier to identify the policy assignment at a glance in the Azure Portal.

e.g.
```
    "displayName": "HMCTS Keyvault Security Activity Logging - DCD-CFT-Sandbox",
    "id": "/subscriptions/bf308a5c-0624-4334-8ff8-8dca9fd43783/providers/Microsoft.Authorization/policyAssignments/HMCTSKeyVault_DCD-CFT-Sandbox",
    "name": "HMCTSKeyVault_DCD-CFT-Sandbox"
```

When applying a policy to the management group scope, you can leave the displayName without a suffix but make sure to set the id and name to `Global`

e.g.
```
    "displayName": "HMCTS Collect Activity Logs",   
    "id": "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyAssignments/HMCTSDiagnosticGlobal",
    "name": "HMCTSDiagnosticGlobal"
```

### How to test a policy definition

To test a policy definition, create a new policy assignment json file under `assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb`.

This is the `DCD-CFTAPPS-SBOX` subscription which can be used for the purpose of testing that new policy defintions are using valid json and have the expected values before live rollout.

Creating a pull request will trigger a GitHub action that will create your policy definition and assign it to this subscription.

The policy definition and assignment will be appended with `- Sandbox` so you can easily identify it in the Azure Portal.

At this point, you will have a definition assigned to the `DCD-CFTAPPS-SBOX` subscription. In order to test that your policy has the desired effect, a compliance scan must be ran.

This should take place automatically when the assignment is created. You should be able to see what resources are non-compliant and confirm that the resources listed are expected.

### How to test policy remediation

In order to see if the policy will work in practice, a manual remediation task must be ran. This can be done by clicking on the assignment and clicking `Create remediation task`

You can do this for your `- Sandbox` policy assignment from above.

If you want to test on an additional subscription, create another assignment json file under `assignments/subscriptions/bf308a5c-0624-4334-8ff8-8dca9fd43783`. This is the `DCD-CFT-Sandbox` subscription.

If everything is working as expected, submit a new PR with assignments for all the others subscriptions you are targeting resources in.

If your policy should take effect over all subscriptions after testing, remove the subscription specific assignments and create an assignment json file under the mgmt-groups folder.

### Policy permissions

Policies that use the deployIfNotExists action should have a list of roleDefinitionIds defined. These are required to remediate non-compliant resources. These permissions must be granted to some sort of identity.

Currently, we use a User Assigned Managed Identity (UAMI) with such policy assignments.

The reason for using a User Assigned instead of a System Assigned Managed Identity is that we can assign the appropriate permissions via code instead of doing this manually.

At the time of writing, `deployIfNotExists` actions require permissions to be manually assigned when being deployed via the manage-azure-policy GitHub action. See https://docs.microsoft.com/en-gb/azure/governance/policy/how-to/remediate-resources#how-remediation-security-works

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

The `soc-sbox-eventhub-azure-policy` identity has Log Analytics Contributor and Monitoring Contributor over the DCD-CFTAPPS-SBOX and DCD-CFT-Sandbox subscriptions that are to be used for testing purposes. It also has the Azure Event Hubs Data Owner role over the Azure Event Hubs Namespace soc-sbox-eventhubns.

The `soc-prod-eventhub-azure-policy` identity has Log Analytics Contributor and Monitoring Contributor over the HMCTS management group. It also has the Azure Event Hubs Data Owner role over the Azure Event Hubs Namespace soc-prod-eventhubns.

These roles and permissions should be sufficient for your needs, however, if you need to add extra subscription scopes to the `soc-sbox-eventhub-azure-policy` identity for the purposes of testing, you can update the [terraform code](https://github.com/hmcts/soc/blob/master/modules/eventhub/roles.tf).

You should not need to grant additional permissions to the `soc-prod-eventhub-azure-policy` identity

Policies that do not use the `deployIfNotExists` action, e.g. our tagging policies, do not require permissions since they are simply evaluating resources.

### Policy Structure
You can find more detail on the structure of a `Policy`, `Initiative` or `Assignment` in the following [Azure Policy](https://docs.microsoft.com/en-gb/azure/governance/policy/) documentation
- [Definition Structure](https://docs.microsoft.com/en-gb/azure/governance/policy/concepts/definition-structure)
- [Initiative Structure](https://docs.microsoft.com/en-gb/azure/governance/policy/concepts/initiative-definition-structure)
- [Assignment structure](https://docs.microsoft.com/en-gb/azure/governance/policy/concepts/assignment-structure)


### Workflow permissions

A [custom role](./custom_role.json) was created for the workflow, it's basically a copy of the `Resource Policy Contributor` built in role with a few extra permissions to list Management Groups and Subscriptions. 
