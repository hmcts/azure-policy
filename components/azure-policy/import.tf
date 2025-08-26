import {
  for_each = var.env == "sbox" ? local.policies : []
  to       = azurerm_policy_definition.policies["each.key"]
  id       = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/${each.key}"
}