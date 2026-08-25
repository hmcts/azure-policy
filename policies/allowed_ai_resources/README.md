# HMCTS Allowed AI Resources Policy

This policy applies to `Microsoft.CognitiveServices/accounts` and requires:

- UK South location
- local authentication disabled
- network ACLs to deny by default
- outbound network access restricted
- public network access disabled

## Pilot

The policy is assigned to the CFT Sandbox subscription in `Audit` mode. It records non-compliant resources without blocking deployment.

## Exceptions

An exception requires approval through a pull request. Add the exact resource group resource ID and the approved justification to `notScopes` in [the CFT Sandbox assignment](../../assignments/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/assign.allowed_ai_resources.json). Subscription-wide exceptions are not permitted.