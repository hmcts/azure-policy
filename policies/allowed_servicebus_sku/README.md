# HMCTS Disk SKU Policy

The policy enables you to specify a set of SKUs for service bus that can be deployed in HMCTS.

## Required SKUs

The specific SKU sizes that are enforced by the policy:


| Name             | Environments             |
| --------------   | --------------  |
| Premium | Prod    |
| Standard | Sandbox, NonProd, Prod |
| Basic  | Sandbox, NonProd, Prod     |

## Exemptions 

Send a pull request to [assignments/mgmt-groups/mg-HMCTS/assign.allowed_servicebus_sku.json](https://github.com/hmcts/azure-policy/blob/HEAD/assignments/mgmt-groups/mg-HMCTS/assign.allowed_servicebus_sku.json) with justification for why you need to use one that does not meet the above specification.
