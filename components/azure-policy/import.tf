import {
    for_each = var.env == "sbox" ? 1 : 0
    to = azurerm_policy_definition.policies["ExpiresAfterTagging"]
    id = "/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/ExpiresAfterTagging"
}