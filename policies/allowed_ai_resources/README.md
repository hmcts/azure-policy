# HMCTS Allowed AI Resources Policy

This policy applies to `Microsoft.CognitiveServices/accounts` and `Microsoft.CognitiveServices/accounts/deployments` and requires:

- UK South location
- local authentication disabled
- network ACLs to deny by default
- outbound network access restricted
- public network access disabled
- `Standard` model deployments, which process inference data in the deployment region

## Assignment

The policy is assigned to the HMCTS management group in `Audit` mode. It records non-compliant resources without blocking deployment.

## Exceptions

An exception requires approval through a pull request. Add the exact resource group resource ID and the approved justification to `notScopes` in [the HMCTS management-group assignment](../../assignments/mgmt-groups/mg-HMCTS/assign.allowed_ai_resources.json). Subscription-wide exceptions are not permitted.