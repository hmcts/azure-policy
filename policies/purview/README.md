# HMCTS Purview Security Activity Logging

Policy to forward Azure Purview activity logs to an Azure Event Hub for consumption by Splunk.
This is an adaptation of a built-in policy provided by Microsoft.

## Event Hub Name
Name of the SOC event hub as a string. There are specific event hubs for each PaaS component within the event hubs namespace.

In the case of purview, there is an event hub called purview_audit.

## Event Hub Authorization Rule
Resource path to shared access policy at event hubs namespace level. Shared access policy requires *send* claims.

Must start with /subscription/{subscriptionId} or /providers/{resourceProviderNamespace}
e.g. /providers/Microsoft.EventHub/namespaces/{eventHubNamespace}/authorizationRules/{sasPolicyName}

### Notice

It should be noted that the built-in Microsoft policies that send diagnostic logs to Azure Event Hubs use the `eventHubAuthRuleId` parameter to denote the Event Hub Authorization Rule. The equivalent parameter in this repo is `eventHubAuthRule`.

Make sure any policies for sending logs to Azure Event Hubs uses the `eventHubAuthRule` parameter to avoid errors.

## Log categories

The following log categories are enabled:

* ScanStatus
* DataSensitivity
* PurviewAccountAuditEvents

## Parameters Reference

There are certain parameters and settings in this policy that are required in order for it to work. 

The parameter profileName will be what appears on the diagnostic settings page.

The name of the Purview account is programmatically set when the policy is evaluated and remediated.

The name of the Purview account is concatenated with the Microsoft.Insights provider and the profileName parameter to enable the policy to be successfully applied.