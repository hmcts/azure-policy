# Collect all .json.tpl files under the policies directories
# Render all templates according to current environment
# Create policy definition for current env

# Collect all .json.tpl files under assignments/subscriptions/* 
# Create a policy assignment for each file

resource "azurerm_policy_definition" "policies" {
  for_each = local.policies

  name         = each.key
  display_name = try(var.name_suffix == "" ? each.value.properties.displayName : join(" - ", [each.value.properties.displayName, var.name_suffix]), each.key)
  description  = try(each.value.properties.description, "")
  policy_type  = try(each.value.properties.policyType, "Custom")
  mode         = each.value.properties.mode

  policy_rule = jsonencode(each.value.properties.policyRule)
  parameters  = try(jsonencode(each.value.properties.parameters), "{}")

  management_group_id = var.management_group
}

# resource "azurerm_management_group_policy_assignment" "mgmt_assignments" {
#
# }

resource "azurerm_subscription_policy_assignment" "subscription_assignments" {
  for_each = local.subscription_assignments

  name = var.name_suffix == "" ? each.value.name : join("_", [each.value.name, var.name_suffix])

  subscription_id      = trimprefix(each.value.properties.scope, "/subsciptions/")
  policy_definition_id = each.value.properties.policyDefinitionId

  description  = each.value.properties.description
  display_name = each.value.properties.displayName
  enforce      = each.value.properties.enforcementMode == "Default"
  metadata     = each.value.properties.metadata

  dynamic "non_compliance_message" {
    for_each = each.value.properties.nonComplianceMessages
    content {
      content = each.value.message
    }
  }

  not_scopes = each.value.properties.notScopes
  parameters = each.value.properties.parameters

  # Need policy assignments to be defined before we can reference them
  depends_on = [azurerm_policy_definition.policies]
}