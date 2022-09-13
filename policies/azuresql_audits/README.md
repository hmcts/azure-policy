# HMCTS Collect Activity Logs Policy

Policy to forward Azure SQL Database activity logs to an Azure Event Hub for consumption by Splunk.

## Event Hub Name
Name of the SOC event hub namespace as a string. There are event hubs for the sbox and prod environments

## Event Hub Authorization Rule
Resource path to shared access policy. Shared access policy requires *send* claims.

Must start with /subscription/{subscriptionId} or /providers/{resourceProviderNamespace}
e.g. /providers/Microsoft.EventHub/namespaces/{eventHubNamespace}/authorizationRules/{sasPolicyName}

### Notice

It should be noted that the built-in Microsoft policies that send diagnostic logs to Azure Event Hubs use the `eventHubAuthRuleId` parameter to denote the Event Hub Authorization Rule. The equivalent parameter in this repo is `eventHubAuthRule`.

Make sure any policies for sending logs to Azure Event Hubs uses the `eventHubAuthRule` parameter to avoid errors.

## Log categories

The following log categories are enabled:

* SQLSecurityAuditEvents
