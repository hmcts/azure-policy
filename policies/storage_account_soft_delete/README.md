# Production Storage Account Soft Delete Policy

This policy denies configuration of a **production** storage account's blob, container, or file share soft delete unless it is enabled with a retention period of at least `minimumRetentionDays` (default 14 days). It is only assigned in live subscriptions.

## Identifying production

A storage account is treated as **production** unless its name, resource group name, or `environment` tag contains one of the `nonProductionIdentifiers` (default `prp`, `prx`). Matching is case-insensitive.

## What is checked

For each storage account, the following must all be true:

- Container (blob) soft delete (`containerDeleteRetentionPolicy`) is enabled with `days >= minimumRetentionDays`
- Blob soft delete (`deleteRetentionPolicy`) is enabled with `days >= minimumRetentionDays`
- File share soft delete (`shareDeleteRetentionPolicy`) is enabled with `days >= minimumRetentionDays`

## Parameters

| Parameter                | Default        | Description                                                                 |
| ------------------------ | -------------- | ----------------------------------------------------------------------------- |
| `minimumRetentionDays`   | `14`           | Minimum required soft delete retention period, in days                        |
| `nonProductionIdentifiers` | `["prp", "prx"]` | Substrings identifying a storage account/resource group/tag as non-production |

## Exemptions

Send a pull request to the relevant assignment file under [assignments/live/subscriptions](https://github.com/hmcts/cpp-azure-policy/tree/HEAD/assignments/live/subscriptions) with justification if a production storage account needs to be excluded via `notScopes`.
