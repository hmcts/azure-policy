# HMCTS Tagging Policy 

## Required tags
Required tags, common and specific to subscription of resource.

All environments and resources: 
 - "environment"
 - "application"
 - "businessArea"
 - "builtFrom"
     
Specific Sandbox Tags:
 - "deleteBy"
 
## Allowed values
Tags and their allowed values.

application:
 - "core"

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
 - url to repository
