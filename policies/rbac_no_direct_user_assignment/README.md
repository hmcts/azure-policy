# HMCTS Restrict Direct User RBAC Assignments

This policy denies direct Azure RBAC role access for individual user identities. Access must be granted through Microsoft Entra ID Groups, Service Principals, or Managed Identities.

The policy covers:

- Permanent Azure RBAC role assignments using `Microsoft.Authorization/roleAssignments`.
- PIM eligible role schedule requests using `Microsoft.Authorization/roleEligibilityScheduleRequests`.
- PIM active role schedule requests using `Microsoft.Authorization/roleAssignmentScheduleRequests`.

For PIM schedule requests, the policy denies direct user requests that create, update, extend, renew, or activate direct role access. Removal and deactivation request types are not denied so existing direct user access can still be cleaned up.

## Denied principal type

The policy denies requests where the relevant `principalType` is `User`.

## Allowed assignment routes

Use one of the following principal types instead:

- Microsoft Entra ID Groups
- Service Principals
- Managed Identities

## Effect

The `effect` parameter supports `Audit`, `Deny`, and `Disabled`.