# HMCTS Collect Activity Logs Policy

Policy to forward subscription activity logs to an Azure Event Hub for consumption by Splunk.

## Event Hub Name
Name of the SOC event hub namespace as a string. There are event hubs for the sbox and prod environments

## Event Hub Authorization Rule
Resource path to shared access policy. Shared access policy requires *send* claims.

Must start with /subscription/{subscriptionId} or /providers/{resourceProviderNamespace}
e.g. /providers/Microsoft.EventHub/namespaces/{eventHubNamespace}/authorizationRules/{sasPolicyName}

## Log categories

The following log categories are enabled:

* Administrative
* Security
* ServiceHealth
* Alert
* Recommendation
* Policy
* Autoscale
* ResourceHealth
