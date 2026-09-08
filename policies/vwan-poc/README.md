# HMCTS vWAN PoC Network Group Policy

## vwan-poc

This policy adds every virtual network tagged `project=vwan-poc` to the `vwan-poc` Network Group, so the PoC's hub/spoke VNETs (`poc-vwan-hub-terraform`) are automatically enrolled without manual Network Manager configuration.

### Exceptions

If you need a VNET tagged `project=vwan-poc` excluded, raise a PR adding the Resource Group to the assignment's `notScopes`.

## Check compliance

You can view the current compliance status in the [Azure portal Policy page](https://portal.azure.com/#view/Microsoft_Azure_Policy/PolicyMenuBlade/~/Overview), search for **HMCTS vWAN PoC Network Group Policy - (HMCTS MG)** then type your teams name to find any resources that are not compliant.
