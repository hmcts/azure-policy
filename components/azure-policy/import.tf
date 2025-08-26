import {
  for_each = var.env == "sbox" ? 1 : 0
  to       = azurerm_policy_definition.policies["ExpiresAfterTagging"]
  id       = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/ExpiresAfterTagging"
}

import {
  for_each = var.env == "sbox" ? 1 : 0
  to       = azurerm_policy_definition.policies["HMCTSAGWDiagnostic"]
  id       = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/HMCTSAGWDiagnostic"
}

import {
  for_each = var.env == "sbox" ? 1 : 0
  to       = azurerm_policy_definition.policies["HMCTSAutoTagging"]
  id       = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/HMCTSAutoTagging"
}

import {
  for_each = var.env == "sbox" ? 1 : 0
  to       = azurerm_policy_definition.policies["HMCTSAzureSQLAudit"]
  id       = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/HMCTSAzureSQLAudit"
}