# HMCTS Restrict Direct User RBAC Assignments

This policy covers two separate denial conditions:

1. **Permanent direct user RBAC assignments** — denies any `Microsoft.Authorization/roleAssignments` where `principalType` is `User`. All users are blocked; access must be granted through Entra ID Groups, Service Principals, or Managed Identities.

2. **Time-bound PIM eligible assignments for privileged administrator roles** — denies `Microsoft.Authorization/roleEligibilityScheduleRequests` where the requested role is in the configured list of privileged role definition IDs and the schedule includes a time-bound expiration (`AfterDateTime` or `AfterDuration`). This applies regardless of whether the principal is a user or group.

## Why two separate conditions?

PIM eligibility requests are a distinct ARM resource type from permanent role assignments. The portal creates eligibility requests without including `principalType` in the write payload, so the policy targets the privileged **role definition ID** and **expiration type** instead, which are reliably present at request time.

## Privileged roles covered by the PIM condition

The default `privilegedEligibleRoleDefinitionIds` parameter includes the following roles:

| Role | GUID | Type |
|---|---|---|
| Owner | `8e3af657-a8ff-443c-a75c-2fe8c4bcb635` | BuiltIn |
| Contributor | `b24988ac-6180-42a0-ab88-20f7382dd24c` | BuiltIn |
| Access Review Operator Service Role | `76cc9ee4-d5d3-4a45-a930-26add3d73475` | BuiltIn |
| AKS_Managed_Identity_IAM_permission | `47f63fd2-88d0-4e8b-a9d3-ec1b22dbcda8` | Custom |
| Anyscale Platform Administrator Role | `3e9f3756-203e-4734-a0b8-4b68691ffae3` | BuiltIn |
| Azure Contributor Role minus deletes | `1b0ab888-75d4-8745-1775-d28ca6f274bd` | Custom |
| PIM Azure Contributor | `3708454d-4324-72bf-2d6b-e12fabe44e76` | Custom |
| Reservations Administrator | `a8889054-8d42-49c9-bc1c-52486c10e7cd` | BuiltIn |
| Role Assigner | `46353517-4294-41a8-9fb7-b59022f438db` | Custom |
| Role Based Access Control Administrator | `f58310d9-a9f6-439a-9e8d-f62e7b41a168` | BuiltIn |
| Service Group Administrator | `4e50c84c-c78e-4e37-b47e-e60ffea0a775` | BuiltIn |
| Service Group Contributor | `32e6a4ec-6095-4e37-b54b-12aa350ba81f` | BuiltIn |
| User Access Administrator | `18d7d88d-d35e-4fb5-a5c3-7773c20a72d9` | BuiltIn |

To add or remove roles, override the `privilegedEligibleRoleDefinitionIds` parameter in the relevant assignment file with the updated list of role GUIDs.

## What is not blocked

- Time-bound PIM eligible assignments for **non-privileged roles** are allowed. The expiration restriction only applies to the roles listed in the privileged role table above.
- PIM eligible assignments with no expiry (`NoExpiration`) for privileged roles are allowed.


## Allowed assignment routes

For permanent access, use one of the following principal types:

- Microsoft Entra ID Groups
- Service Principals
- Managed Identities

## Effect

The `effect` parameter supports `Audit`, `Deny`, and `Disabled`. Assignments currently set this to `Deny`.