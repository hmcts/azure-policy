# HMCTS Tagging Policy

## Required tags
Required tags, common and specific to subscription of resource.

All environments and resources: 
 - environment
 - application
 - businessArea
 - builtFrom

Sandbox only:
 - expiresAfter
     
## Allowed values
Tags and their allowed values.

application:

 - You can find a list of valid application names in the [terraform-modules-common-tags](https://github.com/hmcts/terraform-module-common-tags/blob/master/team-config.yml) repository or the [cnp-jenkins-config](https://github.com/hmcts/cnp-jenkins-config/blob/master/team-config.yml) repository

environment:
 - sandbox
 - development
 - testing
 - demo
 - ITHC
 - staging
 - production
 
businessArea:
 - CFT
 - crime
 - Cross-Cutting
 
builtFrom: 
 - Name or URL of repository

expiresAfter (sandbox only):
 - YYYY-MM-DD
 
 
## Check compliance

You can view the current compliance status in the Azure portal.

- [CFT](https://portal.azure.com/#view/Microsoft_Azure_Policy/PolicyComplianceDetailedBladeV3/id/%2Fproviders%2Fmicrosoft.management%2Fmanagementgroups%2Fhmcts%2Fproviders%2Fmicrosoft.authorization%2Fpolicyassignments%2Fhmctstaggingglobal/scopes~/%5B%22%2Fproviders%2FMicrosoft.Management%2FmanagementGroups%2FCFT%22%5D/policyDefinitionId/%2Fproviders%2Fmicrosoft.management%2Fmanagementgroups%2Fhmcts%2Fproviders%2Fmicrosoft.authorization%2Fpolicydefinitions%2Fhmctstagging)
- [SDS](https://portal.azure.com/#view/Microsoft_Azure_Policy/PolicyComplianceDetailedBladeV3/id/%2Fproviders%2Fmicrosoft.management%2Fmanagementgroups%2Fhmcts%2Fproviders%2Fmicrosoft.authorization%2Fpolicyassignments%2Fhmctstaggingglobal/scopes~/%5B%22%2Fproviders%2FMicrosoft.Management%2FmanagementGroups%2FSDS%22%5D/policyDefinitionId/%2Fproviders%2Fmicrosoft.management%2Fmanagementgroups%2Fhmcts%2Fproviders%2Fmicrosoft.authorization%2Fpolicydefinitions%2Fhmctstagging)
- [All](https://portal.azure.com/#view/Microsoft_Azure_Policy/PolicyComplianceDetailedBladeV3/id/%2Fproviders%2Fmicrosoft.management%2Fmanagementgroups%2Fhmcts%2Fproviders%2Fmicrosoft.authorization%2Fpolicyassignments%2Fhmctstaggingglobal/scopes~/%5B%22%2Fproviders%2FMicrosoft.Management%2FmanagementGroups%2FHMCTS%22%5D/policyDefinitionId/%2Fproviders%2Fmicrosoft.management%2Fmanagementgroups%2Fhmcts%2Fproviders%2Fmicrosoft.authorization%2Fpolicydefinitions%2Fhmctstagging)

Type your teams name to find any resources.
