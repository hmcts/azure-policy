locals {
  policy_dir       = "../../policies/"
  subscription_dir = "../../assignments/${var.tenant}/subscriptions"
  management_dir   = "../../assignments/${var.tenant}/mgmt-groups"

  policy_files = [
    for policy in fileset(local.policy_dir, "**/*.json") :
    jsondecode(file(join("", [local.policy_dir, policy])))
  ]
  policies = {
    for p in local.policy_files :
    p.name => p
  }

  subscription_assignment_files = [
    for assignment in fileset(local.subscription_dir, "*.json") :
    jsondecode(file(join("", [local.subscription_dir, assignment])))
  ]

  subscription_assignments = {
    for a in local.subscription_assignment_files :
    a.name => a
  }

  management_assignment_files = [
    for assignment in fileset(local.management_dir, "*.json") :
    jsondecode(file(join("", [local.management_dir, assignment])))
  ]

  management_assignments = {
    for a in local.management_assignment_files :
    a.name => a
  }
}