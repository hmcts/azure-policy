locals {
    policy_files = [
        for policy in fileset("../../policies/", "**/*.json") : 
            jsondecode(policy)
    ]
    policies = {
        for p in local.policy_files:
            p.name => p
    }

    subscription_assignment_files = [
        for assignment in fileset("../../assignments/${var.tenant}/mgmt-groups/", "**/*.json") :
            jsondecode(assignment)
    ]

    subscription_assignments = {
        for a in local.subscription_assignment_files:
            a.name => a
    }
}