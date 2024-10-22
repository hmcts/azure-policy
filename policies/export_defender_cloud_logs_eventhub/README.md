# Export MS Defender for Cloud logs to EventHub

Export any logs for Defender for Cloud to a specific EventHub

## Parameters

- Name: Resource group name
  Type: String

- Name: Resource group location
  Type: String

- Name: Create resource group
  Type: Boolean
  Default Value:
    true
  Allowed Values:
    true;
    false

- Name: Exported data types
  Type: Array
  Default Value:
    Security recommendations;
    Security alerts;
    Overall secure score;
    Secure score controls;
    Regulatory compliance;
    Overall secure score - snapshot;
    Secure score controls - snapshot;
    Regulatory compliance - snapshot;
    Security recommendations - snapshot;
    Security findings - snapshot
  Allowed Values:
    Security recommendations;
    Security alerts;
    Overall secure score;
    Secure score controls;
    Regulatory compliance;
    Overall secure score - snapshot;
    Secure score controls - snapshot;
    Regulatory compliance - snapshot;
    Security recommendations - snapshot;
    Security findings - snapshot

- Name: Recommendation IDs
  Type: Array
  Default Value:
    []

- Name: Recommendation severities
  Type: Array
  Default Value:
    High;
    Medium;
    Low
  Allowed Values:
    High;
    Medium;
    Low

- Name: Include security findings
  Type: Boolean
  Default Value:
    true
  Allowed Values:
    true;
    false

- Name: Secure Score Controls IDs
  Type: Array
  Default Value:
    []

- Name: Alert severities
  Type: Array
  Default Value:
    High;
    Medium;
    Low
  Allowed Values:
    High;
    Medium;
    Low

- Name: Regulatory compliance standards names
  Type: Array
  Default Value:
    []

- Name: Event Hub details
  Type: String
