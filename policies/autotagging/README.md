# HMCTS Auto Tagging Policy

Automatically applys a tag with a given name/value using the modify effect.
# Parameters

## excludedResourceTypes
These resource types are excluded from the auto tagging policy.

Example value:
`
[
    "Microsoft.Network/networkWatchers",
    "microsoft.alertsmanagement/smartdetectoralertrules",
    "microsoft.insights/actiongroups",
    "Microsoft.Insights/activityLogAlerts",
    "microsoft.operationsmanagement/solutions",
    "Microsoft.ContainerRegistry/registries/tasks"
]
`

## tagName
The name of the tag to auto add/update

Example value: `environment`

## tagValue
The value to tag to auto add/update

Example value: `testing`
