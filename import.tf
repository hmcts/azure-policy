import {
  for_each = var.env == "nonlive" ? [0] : []
  id       = "/providers/Microsoft.Management/managementGroups/e2995d11-9947-4e78-9de6-d44e0603518e/providers/Microsoft.Authorization/policyDefinitions/HMCTSResourceLocationPolicy"
  to       = azurerm_policy_definition.policies["HMCTSResourceLocationPolicy"]
}
