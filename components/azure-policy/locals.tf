locals {
  policy_dir       = "../../policies/"
  subscription_dir = "../../assignments/${var.tenant}/subscriptions/"
  mgmt_group_dir   = "../../assignments/${var.tenant}/mgmt-groups/"

  policy_files = [
    for policy in fileset(local.policy_dir, "**/*.json") :
    jsondecode(file(join("", [local.policy_dir, policy])))
  ]
  policies = {
    for p in local.policy_files :
    p.name => p
  }

  subscription_assignment_files = [
    for assignment in fileset("../../assignments/${var.tenant}/mgmt-groups/", "**/*.json") :
    jsondecode(assignment)
  ]

  subscription_assignments = {
    for a in local.subscription_assignment_files :
    a.name => a
  }
}