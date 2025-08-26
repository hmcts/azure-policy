import {
  for_each = [local.policies, {}][var.env == "sbox" ? 0 : 1]
  to       = azurerm_policy_definition.policies[each.key]
  id       = "/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/providers/Microsoft.Authorization/policyDefinitions/${each.key}"
}