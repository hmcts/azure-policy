#!/bin/bash
set -ex

export SUB_ASSIGNMENTS=$(find ./assignments/$SUB  -type f -name 'assign.*.json')
# Where we want to test assignment of policies which are already built into Azure process those separately
# Without modifying the policyDefinitionId to point to a custom created policy definition
export BUILTIN_SUB_ASSIGNMENTS=$(find ./assignments/$SUB -type f -name 'builtin.assign.*.json')
export MGMT_ASSIGNMENTS=$(find ./assignments/mgmt-groups/mg-cft-sandbox -type f -name 'assign.*.json')
export POLICIES=$(find ./policies -name policy.json -type f )
export ENVIRONMENT=${ENVIRONMENT:-Sandbox}
export ASSIGNMENTS_DIR="./${ENVIRONMENT:-Sandbox}/assignments"
export POLICIES_DIR="./${ENVIRONMENT:-Sandbox}/policies"

mkdir -p ${ASSIGNMENTS_DIR} ${POLICIES_DIR}


echo "Creating Sandbox Policies"
for policy in ${POLICIES}; do
    FILE=$(basename ${policy})
    DIR=$(basename "$(dirname ${policy})" )
    mkdir -p ${POLICIES_DIR}/${DIR}

    echo "Creating file: ${POLICIES_DIR}/${DIR}/${FILE}"
    npx json -f ${policy} \
    -e 'this.name=this.name + process.env.ENVIRONMENT' \
    -e 'this.properties.displayName=this.properties.displayName + " - " + process.env.ENVIRONMENT ' \
    -e 'this.id=process.env.SUB + "/providers/Microsoft.Authorization/policyDefinitions/" + this.name' > ${POLICIES_DIR}/${DIR}/${FILE}

done

process_subscription_assignment() {
    assignment=$1
    built_in_assignment=$2

    FILE=$(basename ${assignment})
    DIR=$(basename "$(dirname ${assignment})" )
    mkdir -p ${ASSIGNMENTS_DIR}/${DIR}
    if [ "$built_in_assignment" = true ]; then
        echo "Creating file for built-in policy: ${ASSIGNMENTS_DIR}/${DIR}/${FILE}"
        # Manage-azure-policy action will only process files with assign. prefix so remove builtin prefix
        NORMALISED_FILE_NAME=$(echo ${FILE} | sed 's/^builtin\.//')
        CUSTOM_POLICY_DEFINITION_ID=""
        npx json -f ${assignment} \
        -e 'this.properties.scope=process.env.SUB' \
        -e 'this.name=this.name + "_" + process.env.ENVIRONMENT' \
        -e 'this.properties.displayName=this.properties.displayName + " - " + process.env.ENVIRONMENT ' \
        -e 'this.properties.policyDefinitionId=this.properties.policyDefinitionId' \
        -e 'this.properties.notScopes=[]' \
        -e 'this.id=process.env.SUB + "/providers/Microsoft.Authorization/policyAssignments/" + this.name' > ${ASSIGNMENTS_DIR}/${DIR}/${NORMALISED_FILE_NAME}
    else
        echo "Creating file for custom policy: ${ASSIGNMENTS_DIR}/${DIR}/${FILE}"
        npx json -f ${assignment} \
        -e 'this.properties.scope=process.env.SUB' \
        -e 'this.name=this.name + "_" + process.env.ENVIRONMENT' \
        -e 'this.properties.displayName=this.properties.displayName + " - " + process.env.ENVIRONMENT ' \
        -e 'this.properties.policyDefinitionId=process.env.SUB + "/providers/Microsoft.Authorization/policyDefinitions/" + this.properties.policyDefinitionId.split("/").pop() + process.env.ENVIRONMENT' \
        -e 'this.properties.notScopes=[]' \
        -e 'this.id=process.env.SUB + "/providers/Microsoft.Authorization/policyAssignments/" + this.name' > ${ASSIGNMENTS_DIR}/${DIR}/${FILE}
    fi
}

echo "Creating Sandbox Subscription Assignments"
for assignment in ${SUB_ASSIGNMENTS}; do
    process_subscription_assignment "$assignment" false
done

for assignment in ${BUILTIN_SUB_ASSIGNMENTS}; do
    process_subscription_assignment "$assignment" true
done

## Commented out for now, this will not work with policies created at subscription level as we do above (line 15).
## For this to work we can only assign a policy that exists at or above the management group itself i.e. the already deployed policies that are created at HMCTS management group

# echo "Creating Sandbox Management Group Assignments"
# for assignment in ${MGMT_ASSIGNMENTS}; do
#     FILE=$(basename ${assignment})
#     DIR=$(basename "$(dirname ${assignment})" )
#     mkdir -p ${ASSIGNMENTS_DIR}/${DIR}

#     echo "Creating file: ${ASSIGNMENTS_DIR}/${DIR}/${FILE}"
#     npx json -f ${assignment} \
#     -e 'this.properties.displayName=this.properties.displayName + " - " + process.env.ENVIRONMENT' \
#     -e 'this.properties.description=this.properties.description + " - " + process.env.ENVIRONMENT' \
#     -e 'this.properties.policyDefinitionId=process.env.SUB + "/providers/Microsoft.Authorization/policyDefinitions/" + this.properties.policyDefinitionId.split("/").pop() + process.env.ENVIRONMENT' > ${ASSIGNMENTS_DIR}/${DIR}/${FILE}

# done
