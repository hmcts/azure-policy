# HMCTS Tagging Policy 

## Required tags
Required tags, common and specific to subscription of resource.

All environments and resources: 
 - "environment"
 - "application"
 - "businessArea"
 - "builtFrom"
     
## Allowed values
Tags and their allowed values.

application:

 - You can find a list of valid application names in the [terraform-modules-common-tags](https://github.com/hmcts/terraform-module-common-tags/blob/master/team-config.yml) repo or the [cnp-jenkins-config](https://github.com/hmcts/cnp-jenkins-config/blob/master/team-config.yml) repo

environment:
 - "sandbox"
 - "development"
 - "testing"
 - "demo"
 - "ITHC"
 - "staging"
 - "production"
 
businessArea:
 - "CFT"
 - "crime"
 - "cross-cutting"
 
 builtFrom: 
 - Name or URL of repository
