# Storage Account Soft Delete Policy

This policy denies configuration of a storage account's blob, container, or file share soft delete unless it is enabled with a retention period of at least `minimumRetentionDays` (default 14 days).

## What is checked

For each storage account, the following must all be true:

- Container (blob) soft delete (`containerDeleteRetentionPolicy`) is enabled with `days >= minimumRetentionDays`
- Blob soft delete (`deleteRetentionPolicy`) is enabled with `days >= minimumRetentionDays`
- File share soft delete (`shareDeleteRetentionPolicy`) is enabled with `days >= minimumRetentionDays`

## Parameters

| Parameter                | Default        | Description                                                                 |
| ------------------------ | -------------- | ----------------------------------------------------------------------------- |
| `minimumRetentionDays`   | `14`           | Minimum required soft delete retention period, in days                        |


## Exemptions

Send a pull request to the relevant assignment file under [assignments](https://github.com/hmcts/azure-policy/tree/HEAD/assignments) with justification if a storage account needs to be excluded via `notScopes`.
