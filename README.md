# azure-policy

### What is this for?

This repo stores azure policy definitions and assignments. 

### How to create a new policy definition

Create a new sub-directory under `policies` and name it for the purpose of the policy e.g. tagging.

Create a policy definition json file in the new sub-directory. It should be named `policy.json`.

### How to create a new policy assignment

Before creating an assignment you must decide on a scope. It is possible to scope a policy assignment at the management group or subscription level.

Policies that are to be assigned to a management group are located within the appropriate management group directory under `assignments/mgmt-groups`.

Policies that are to be assigned to a subscription or group of subscriptions are located within the appropriate subscription directory under `assignments/subscriptions`.

When you've decided on a scope, create a policy assignment file in the appropriate directory. Name the file assign.policyname.json e.g. `assign.tagging.json`

### How to add a new subscription

Create a new directory named for the subscription id under the `assignments/subscriptions` directory.

Azure policy requires the subscription id and does not recognise friendly names.

### How to test a policy definition

To test a policy definition, create a new policy assignment json file under `assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb`.

This is the `DCD-CFTAPPS-SBOX` subscription which can be used for the purpose of testing that new policy defintions are using valid json and have the expected values before live rollout.

Creating a pull request will trigger a GitHub action that will create your policy definition and assign it to this subscription.

The policy definition and assignment will be appended with `- Sandbox` so you can easily identify it in the Azure Portal.

At this point, you will have a definition assigned to the DCD-CFTAPPS-SBOX subscription. In order to test that your policy has the desired effect, a compliance scan must be ran.

This should take place automatically when the assignment is created. You should be able to see what resources are non-compliant and confirm that the resources listed are expected.

In order to see if the policy will work in practice, a manual remediation task must be ran. This can be done by clicking on the assignment and clicking `Create remediation task`

It should be noted that if the policy you are creating requires permissions over resources in another subscription e.g. if the policy is to forward diagnostic logs to an event hub in one of the SOC subscriptions, remediation will fail. This is because the policy also needs to be assigned to the other subscription as well but this will not take effect until after your PR is merged.

Therefore, you must assign your policy to the subscription you are looking for non-compliant resources in, i.e. DCD-CFTAPPS-SBOX, as well as the subscription where the other resources, such as event hubs, exist, i.e. HMCTS-SOC-SBOX.

When your pull request is approved and merged, a new policy definition will be created as well as an assignment for each of the scopes you have defined in your policy assignment json file.

### How to test policy remediation

To test that your policy will successfully remediate non-compliant resources, you should assign it to the DCD-CFTAPPS-SBOX and DCD-CFT-Sandbox subscriptions.

Assignments will be created for these scopes when your PR is merged and you can run a remediation task to test all is working as expected.

If everything is working as expected, submit a new PR with assignments for all the subscriptions you are targeting resources in or, in the case of management groups, remove the subscription specific assignments and create an assignment json file under the mgmt-groups folder.

### Naming conventions for deployIfNotExists policies

Policies that use the deployIfNotExists action require permissions in order to make any changes that are necessary to ensure compliance.

When you create an assignment, a SystemAssigned managed identity is also created to enforce the policy.

The name of the managed identity will be the same as the name of your policy assignment.

In order to prevent creating multiple managed identities with the same name when applying a policy to multiple subscriptions, it is advisable to append the name of the policy assignment with `_SUBSCRIPTION_NAME`.

You must also append the subscription name to the displayName of the policy assignment e.g. Forwards all Activity Logs to an Azure Event Hub - DCD-CFT-Sandbox

This will make it much easier to differentiate managed identities from one another and make it easier to assign permissions.