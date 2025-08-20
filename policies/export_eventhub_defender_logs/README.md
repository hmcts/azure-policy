# HMCTS Deploy export to eventHub for Defender for Cloud data

Creates a Microsoft.Security/Automation and Resource Group that will forward Defender for Cloud data to a specified event hub.

An existing resource can be used but must exist in every subscription that the policy is applied to. If using this method, make sure to set `Create resource group` to `false`.

## Required Parameters

```yaml
- Name: Resource group name
  Type: String

- Name: Event Hub details
  Type: String
  strongType: "Microsoft.EventHub/namespaces/eventhubs/authorizationrules",
```

The Event Hub details parameter is a string format that points directly to the complete auth rule for the event hub consumer group. This is important because the policy breaks this known format down to gather other information.

Example string:

```text
/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.EventHub/namespaces/<eventHub Namespace>/eventhubs/<Event Hub consumer group>/authorizationrules/<Auth Rule Name>
```

## All Parameters

```yaml
- Name: Resource group location
  Type: String

- Name: Create resource group
  Type: Boolean
  Default Value: true
  Allowed Values: true; false

- Name: Exported data types
  Type: Array
  Default Value: Security recommendations; Security alerts; Overall secure score; Secure score controls; Regulatory compliance; Overall secure score - snapshot; Secure score controls - snapshot; Regulatory compliance - snapshot; Security recommendations - snapshot; Security findings - snapshot
  Allowed Values: Security recommendations; Security alerts; Overall secure score; Secure score controls; Regulatory compliance; Overall secure score - snapshot; Secure score controls - snapshot; Regulatory compliance - snapshot; Security recommendations - snapshot; Security findings - snapshot

- Name: Recommendation IDs
  Type: Array
  Default Value: []

- Name: Recommendation severities
  Type: Array
  Default Value: High; Medium; Low
  Allowed Values: High; Medium; Low

- Name: Include security findings
  Type: Boolean
  Default Value:
  Allowed Values: true; false

- Name: Secure Score Controls IDs
  Type: Array
  Default Value: []

- Name: Alert severities
  Type: Array
  Default Value: High; Medium; Low
  Allowed Values: High; Medium; Low

- Name: Regulatory compliance standards names
  Type: Array
  Default Value: []
```
