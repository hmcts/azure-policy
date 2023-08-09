# HMCTS Location Policy

## Allowed locations
HMCTS principle is for all resources within Azure to be deployed into UK south (with some exceptions)

### Exceptions
If you require an exception please create a new PR and add the Resource Group in which you plan to add or update infrustructure in [Here](https://github.com/hmcts/azure-policy/blob/f5882400a823866a66eff009336072b4d35d5b50/assignments/mgmt-groups/mg-HMCTS/assign.allowed_regions.json#L14)

## Check compliance

You can view the current compliance status in the [Azure portal Policy page](https://portal.azure.com/#view/Microsoft_Azure_Policy/PolicyMenuBlade/~/Overview), search for **__HMCTS Location Policy - (HMCTS MG)__** then type your teams name to find any resources that are no compliant.
