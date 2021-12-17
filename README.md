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

### How to test a policy assignment

To test a policy assignment, create a new policy assignment json file under `assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb`.

This is the `DCD-CFTAPPS-SBOX` subscription which can be used for the purpose of testing new policies before live rollout.

Creating a pull request will initiate a github action that will create your policy definition and assign it to this subscription.

The policy definition and assignment will be appended with `- Sandbox` so you can easily identify it in the Azure Portal.

When a pull request is approved and merged, a new policy definition will be created as well as an assignment for each of the scopes you have defined in your policy assignment json file.

### Naming conventions for deployIfNotExists policies

Policies that use the deployIfNotExists action require permissions in order to make any changes that are necessary to ensure compliance.

When you create an assignment, a SystemAssigned managed identity is also created to enforce the policy.

The name of the managed identity will be the same as the name of your policy assignment.

In order to prevent creating multiple managed identities with the same name when applying a policy to multiple subscriptions, it is advisable to append the name of the policy assignment with `_SUBSCRIPTION_NAME`.

This will make it much easier to differentiate managed identities from one another and make it easier to assign permissions.