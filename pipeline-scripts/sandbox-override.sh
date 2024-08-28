#!/bin/bash
set -ex

export SUB_ASSIGNMENTS=$(find ./assignments/$SUB  -type f -name 'assign.*.json')
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

echo "Creating Sandbox Subscription Assignments"
for assignment in ${SUB_ASSIGNMENTS}; do
    FILE=$(basename ${assignment})
    DIR=$(basename "$(dirname ${assignment})" )
    mkdir -p ${ASSIGNMENTS_DIR}/${DIR}

    echo "Creating file: ${ASSIGNMENTS_DIR}/${DIR}/${FILE}"
    npx json -f ${assignment} \
    -e 'this.properties.scope=process.env.SUB' \
    -e 'this.name=this.name + "_" + process.env.ENVIRONMENT' \
    -e 'this.properties.displayName=this.properties.displayName + " - " + process.env.ENVIRONMENT ' \
    -e 'this.properties.policyDefinitionId=process.env.SUB + "/providers/Microsoft.Authorization/policyDefinitions/" + this.properties.policyDefinitionId.split("/").pop() + process.env.ENVIRONMENT' \
    -e 'this.properties.notScopes=[]' \
    -e 'this.id=process.env.SUB + "/providers/Microsoft.Authorization/policyAssignments/" + this.name' > ${ASSIGNMENTS_DIR}/${DIR}/${FILE}

done

echo "Creating Sandbox Management Group Assignments"
for assignment in ${MGMT_ASSIGNMENTS}; do
    FILE=$(basename ${assignment})
    DIR=$(basename "$(dirname ${assignment})" )
    mkdir -p ${ASSIGNMENTS_DIR}/${DIR}

    echo "Creating file: ${ASSIGNMENTS_DIR}/${DIR}/${FILE}"
    npx json -f ${assignment} \
    -e 'this.properties.displayName=this.properties.displayName + " - " + process.env.ENVIRONMENT' \
    -e 'this.properties.description=this.properties.description + " - " + process.env.ENVIRONMENT' \
    -e 'this.properties.policyDefinitionId=this.properties.policyDefinitionId + process.env.ENVIRONMENT' > ${ASSIGNMENTS_DIR}/${DIR}/${FILE}

done
