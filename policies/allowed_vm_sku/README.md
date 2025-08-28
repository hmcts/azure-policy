# HMCTS Virtual Machine SKU Policy

The policy enables you to specify a set of VM SKUs sizes that can be deployed in HMCTS.

## Required virtual machine SKU Sizes

The specific VM SKU sizes that are enforced by the policy:

### General purpose

| Size            |  VM Series     |
| -------------   |  ------------- |
| Small           |  D2ds_v5       |
| Medium          |  D4ds_v5       |
| Large           |  D8ds_v5       |
| Extra Large     |  D16ds_v5      |
| Extremely Large |  D32ds_v5      |

### Memory optimised

| Size            |  VM Series     |
| -------------   |  ------------- |
| Small           |  E2ds_v5       |
| Medium          |  E4ds_v5       |
| Large           |  E8ds_v5       |
| Extra Large     |  E16ds_v5      |
| Extremely Large |  E32ds_v5      |

## Exemptions

Send a pull request to [assignments/mgmt-groups/mg-HMCTS/assign.allowed_vm_sku.json](https://github.com/hmcts/cpp-azure-policy/blob/HEAD/assignments/mgmt-groups/mg-HMCTS/assign.allowed_vm_sku.json) with justification for why you need to use one not on the standard list.
