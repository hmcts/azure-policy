import {
  for_each = [local.policies, {}][var.env == "sbox" ? 0 : 1]
  to       = azurerm_policy_definition.policies[each.key]
  id       = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/${each.key}"
}