# HMCTS Allowed AI Resources Policy

This policy applies to `Microsoft.CognitiveServices/accounts` and requires:

- UK South location
- local authentication disabled
- network ACLs to deny by default
- outbound network access restricted
- public network access disabled

## Pilot

The policy is assigned to the CFT Sandbox management group in `Audit` mode. It records non-compliant resources without blocking deployment.

## Exceptions

An exception requires approval through a pull request. Add the exact resource group resource ID and the approved justification to `notScopes` in [the CFT Sandbox assignment](../../assignments/mgmt-groups/mg-cft-sandbox/assign.allowed_ai_resources.json). Subscription-wide exceptions are not permitted.