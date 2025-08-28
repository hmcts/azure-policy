# HMCTS Disk SKU Policy

The policy enables you to specify a set of disk SKUs sizes that can be deployed in HMCTS.

## Required Disk SKU Sizes

The specific disk SKU sizes that are enforced by the policy:


| Name             | SKU             | Max Size (GB) |
| --------------   | --------------  | ------------- |
| Standard HDD LRS | Standard_LRS    | 2048          |
| Standard SSD LRS | StandardSSD_LRS | 2048          |
| Premium SSD LRS  | Premium_LRS     | 2048          |

## Exemptions

Send a pull request to [assignments/mgmt-groups/mg-HMCTS/assign.allowed_disk_sku.json](https://github.com/hmcts/cpp-azure-policy/blob/HEAD/assignments/mgmt-groups/mg-HMCTS/assign.allowed_disk_sku.json) with justification for why you need to use one that does not meet the above specification.
