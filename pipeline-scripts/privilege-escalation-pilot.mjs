import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const clusterId = '/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/resourceGroups/cft-sbox-01-rg/providers/Microsoft.ContainerService/managedClusters/cft-sbox-01-aks';
const namespace = 'dtspo-35033-mutation-pilot';
const stages = [
  {
    name: 'Pilot',
    clusterId,
    namespaces: [namespace],
    labelSelector: { matchLabels: { 'hmcts.net/mutation-pilot': 'dtspo-35033' } },
  },
  {
    name: 'Preview',
    clusterId: '/subscriptions/8b6ea922-0862-443e-af15-6056e1c9b9a4/resourceGroups/cft-preview-00-rg/providers/Microsoft.ContainerService/managedClusters/cft-preview-00-aks',
    namespaces: [
      'ccd', 'civil', 'family-public-law', 'financial-remedy', 'ia', 'money-claims',
      'pcs', 'private-law', 'probate', 'pt', 'sptribs', 'sscs',
    ],
  },
];
const excludedNamespaces = [
  'kube-system', 'gatekeeper-system', 'azure-arc',
  'azure-extensions-usage-system', 'monitoring',
];
const exceptionSelector = {
  matchExpressions: [{
    key: 'hmcts.net/privilege-escalation-exception', operator: 'NotIn', values: ['approved'],
  }],
};
const cohorts = [
  ['ES934', 'containers', 'hmctsprod.azurecr.io/imported/elastic/elasticsearch:9.3.4'],
  ['ES923', 'containers', 'hmctsprod.azurecr.io/imported/elastic/elasticsearch:9.2.3'],
  ['ES7173', 'containers', 'docker.elastic.co/elasticsearch/elasticsearch:7.17.3'],
  ['ES7171', 'containers', 'docker.elastic.co/elasticsearch/elasticsearch:7.17.1'],
  ['LS924', 'containers', 'hmctsprod.azurecr.io/imported/elastic/logstash:9.2.4'],
  ['LS7161', 'containers', 'hmctsprod.azurecr.io/imported/logstash/logstash:7.16.1'],
  ['CCDLSlatest', 'containers', 'hmctsprod.azurecr.io/ccd/logstash:latest'],
  ['JDBC7700', 'initContainers', 'hmctsprod.azurecr.io/curl:7.70.0'],
];

function buildPolicy([suffix, role, image], stage = stages[0]) {
  const name = `HMCTSNoPrivEsc${stage.name}${suffix}`;
  const containerPath = `spec.${role}[image:${JSON.stringify(image)}]`;
  const activation = stage.name === 'Pilot'
    ? 'Enable only for isolated disposable sandbox tests after targeting acceptance.'
    : 'Enable only after sandbox targeting, application and recovery acceptance.';
  const mutation = {
    apiVersion: 'mutations.gatekeeper.sh/v1',
    kind: 'Assign',
    metadata: { name: name.toLowerCase() },
    spec: {
      applyTo: [{ groups: [''], kinds: ['Pod'], versions: ['v1'], operations: ['CREATE'] }],
      match: {
        scope: 'Namespaced',
        source: 'Original',
        kinds: [{ apiGroups: [''], kinds: ['Pod'] }],
        namespaces: stage.namespaces,
        excludedNamespaces,
        labelSelector: { ...stage.labelSelector, ...exceptionSelector },
      },
      location: `${containerPath}.securityContext.allowPrivilegeEscalation`,
      parameters: {
        pathTests: [{ subPath: containerPath, condition: 'MustExist' }],
        assign: { value: false },
      },
    },
  };
  return {
    properties: {
      displayName: `DTSPO-35033 privilege escalation ${stage.name.toLowerCase()} - ${suffix}`,
      policyType: 'Custom',
      mode: 'Microsoft.Kubernetes.Data',
      description: `${stage.name} mutation for one reviewed image and container role. ${activation} Reviewed workload opt-out: hmcts.net/privilege-escalation-exception=approved. The marker does not verify approval.`,
      metadata: { category: 'Kubernetes', version: '0.1.0', preview: true },
      parameters: {
        effect: {
          type: 'String',
          metadata: {
            displayName: 'Effect',
            description: activation,
          },
          allowedValues: ['Mutate', 'Disabled'],
          defaultValue: 'Disabled',
        },
      },
      policyRule: {
        if: {
          allOf: [
            { field: 'type', equals: 'Microsoft.ContainerService/managedClusters' },
            { field: 'id', equals: stage.clusterId },
          ],
        },
        then: {
          effect: "[parameters('effect')]",
          details: {
            source: 'Original',
            namespaces: stage.namespaces,
            excludedNamespaces,
            mutationInfo: {
              sourceType: 'Base64Encoded',
              content: Buffer.from(JSON.stringify(mutation)).toString('base64'),
            },
          },
        },
      },
    },
    id: `/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/${name}`,
    type: 'Microsoft.Authorization/policyDefinitions',
    name,
  };
}

function checkPolicy(policy, cohort, stage = stages[0]) {
  const [suffix, role, image] = cohort;
  assert.equal(policy.name, `HMCTSNoPrivEsc${stage.name}${suffix}`);
  assert.equal(policy.id, `/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/${policy.name}`);
  assert.equal(policy.type, 'Microsoft.Authorization/policyDefinitions');
  const properties = policy.properties;
  assert.equal(properties.mode, 'Microsoft.Kubernetes.Data');
  assert.equal(properties.parameters.effect.defaultValue, 'Disabled');
  assert.deepEqual(properties.parameters.effect.allowedValues, ['Mutate', 'Disabled']);
  assert.deepEqual(properties.policyRule.if.allOf, [
    { field: 'type', equals: 'Microsoft.ContainerService/managedClusters' },
    { field: 'id', equals: stage.clusterId },
  ]);
  const details = properties.policyRule.then.details;
  assert.deepEqual(Object.keys(details).sort(), ['excludedNamespaces', 'mutationInfo', 'namespaces', 'source']);
  assert.equal(details.source, 'Original');
  assert.deepEqual(details.namespaces, stage.namespaces);
  assert.deepEqual(details.excludedNamespaces, excludedNamespaces);
  assert.equal(details.mutationInfo.sourceType, 'Base64Encoded');
  const mutation = JSON.parse(Buffer.from(details.mutationInfo.content, 'base64').toString('utf8'));
  assert.equal(mutation.apiVersion, 'mutations.gatekeeper.sh/v1');
  assert.equal(mutation.kind, 'Assign');
  assert.deepEqual(mutation.spec.applyTo, [
    { groups: [''], kinds: ['Pod'], versions: ['v1'], operations: ['CREATE'] },
  ]);
  assert.equal(mutation.spec.match.source, 'Original');
  assert.equal(mutation.spec.match.scope, 'Namespaced');
  assert.deepEqual(mutation.spec.match.namespaces, stage.namespaces);
  assert.deepEqual(mutation.spec.match.excludedNamespaces, excludedNamespaces);
  assert.deepEqual(mutation.spec.match.labelSelector, { ...stage.labelSelector, ...exceptionSelector });
  assert.deepEqual(Object.keys(mutation.spec.match).sort(), [
    'excludedNamespaces', 'kinds', 'labelSelector', 'namespaces', 'scope', 'source',
  ].sort());
  assert.deepEqual(mutation.spec.match.kinds, [{ apiGroups: [''], kinds: ['Pod'] }]);
  assert.equal(Object.hasOwn(mutation.spec.match, 'operations'), false);
  const path = `spec.${role}[image:${JSON.stringify(image)}]`;
  assert.equal(mutation.spec.location, `${path}.securityContext.allowPrivilegeEscalation`);
  assert.deepEqual(mutation.spec.parameters, {
    pathTests: [{ subPath: path, condition: 'MustExist' }],
    assign: { value: false },
  });
  assert.equal(mutation.spec.location.includes('ephemeralContainers'), false);
}

function buildAssignment(cohort, stage) {
  const policy = buildPolicy(cohort, stage);
  const scope = stage.clusterId.split('/resourceGroups/')[0];
  const name = `AP-${stage.name[0]}-${cohort[0]}`;
  return {
    properties: {
      metadata: { assignedBy: 'PlatOps' },
      description: `DTSPO-35033 ${stage.name.toLowerCase()} mutation for the exact cluster and reviewed namespaces in the referenced definition.`,
      displayName: policy.properties.displayName,
      enforcementMode: 'Default',
      notScopes: [],
      parameters: { effect: { value: 'Mutate' } },
      policyDefinitionId: policy.id,
      scope,
    },
    type: 'Microsoft.Authorization/policyAssignments',
    id: `${scope}/providers/Microsoft.Authorization/policyAssignments/${name}`,
    name,
  };
}

function checkAssignment(assignment, cohort, stage) {
  assert.deepEqual(assignment, buildAssignment(cohort, stage));
  assert.ok(`${assignment.name}_Sandbox`.length <= 24);
  assert.equal(assignment.properties.scope, stage.clusterId.split('/resourceGroups/')[0]);
  assert.equal(assignment.properties.parameters.effect.value, 'Mutate');
}

const mode = process.argv[2] ?? '--check';
assert.ok(['--self-test', '--check', '--write'].includes(mode), 'Use --self-test, --check or --write');
const policies = cohorts.map(cohort => buildPolicy(cohort));
assert.equal(new Set(policies.map(policy => policy.name)).size, 8);
assert.notEqual(stages[0].clusterId.split('/')[2], stages[1].clusterId.split('/')[2]);
for (const stage of stages) {
  assert.ok(stage.namespaces.length > 0);
  assert.equal(stage.namespaces.some(value => excludedNamespaces.includes(value)), false);
  for (const cohort of cohorts) {
    const policy = buildPolicy(cohort, stage);
    checkPolicy(policy, cohort, stage);
    const otherStage = stages.find(candidate => candidate !== stage);
    assert.throws(() => checkPolicy(policy, cohort, otherStage));
    const wrongCluster = structuredClone(policy);
    wrongCluster.properties.policyRule.if.allOf[1].equals = otherStage.clusterId;
    assert.throws(() => checkPolicy(wrongCluster, cohort, stage));
    const wrongNamespaces = structuredClone(policy);
    wrongNamespaces.properties.policyRule.then.details.namespaces = otherStage.namespaces;
    assert.throws(() => checkPolicy(wrongNamespaces, cohort, stage));
    const wrongMutation = structuredClone(policy);
    const info = wrongMutation.properties.policyRule.then.details.mutationInfo;
    const mutation = JSON.parse(Buffer.from(info.content, 'base64'));
    mutation.spec.match.namespaces = otherStage.namespaces;
    info.content = Buffer.from(JSON.stringify(mutation)).toString('base64');
    assert.throws(() => checkPolicy(wrongMutation, cohort, stage));
    const assignment = buildAssignment(cohort, stage);
    checkAssignment(assignment, cohort, stage);
    assert.throws(() => checkAssignment(assignment, cohort, otherStage));
    for (const change of [
      altered => { altered.properties.scope = otherStage.clusterId.split('/resourceGroups/')[0]; },
      altered => { altered.properties.policyDefinitionId = buildPolicy(cohort, otherStage).id; },
      altered => { altered.properties.parameters.effect.value = 'Disabled'; },
      altered => { altered.properties.enforcementMode = 'DoNotEnforce'; },
    ]) {
      const altered = structuredClone(assignment);
      change(altered);
      assert.throws(() => checkAssignment(altered, cohort, stage));
    }
  }
}
for (const stage of stages) {
  for (const cohort of cohorts) {
    const policy = buildPolicy(cohort, stage);
    checkPolicy(policy, cohort, stage);
    const assignment = buildAssignment(cohort, stage);
    checkAssignment(assignment, cohort, stage);
    const subscriptionId = stage.clusterId.split('/')[2];
    const outputs = [
      [resolve(root, 'policies', policy.name, 'policy.json'), policy],
      [resolve(root, 'assignments', 'subscriptions', subscriptionId,
        `assign.privilege-escalation-${stage.name.toLowerCase()}-${cohort[0].toLowerCase()}.json`), assignment],
    ];
    for (const [target, resource] of outputs) {
      const content = `${JSON.stringify(resource, null, 2)}\n`;
      if (mode === '--write') {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      } else if (mode === '--check') {
        assert.equal(readFileSync(target, 'utf8'), content, `Generated resource differs: ${resource.name}`);
      }
    }
  }
}
assert.deepEqual(policies.slice(0, 7).map(policy => {
  const mutation = JSON.parse(Buffer.from(policy.properties.policyRule.then.details.mutationInfo.content, 'base64'));
  return mutation.spec.location.split('[image:')[0];
}), Array(7).fill('spec.containers'));

const tamperChecks = [
  ['enabled default', policy => { policy.properties.parameters.effect.defaultValue = 'Mutate'; }],
  ['wrong cluster', policy => { policy.properties.policyRule.if.allOf[1].equals = '/subscriptions/other'; }],
  ['broad namespace', policy => { policy.properties.policyRule.then.details.namespaces = []; }],
  ['lost exclusions', policy => { policy.properties.policyRule.then.details.excludedNamespaces = []; }],
];
for (const [label, change] of tamperChecks) {
  const altered = structuredClone(policies[0]);
  change(altered);
  assert.throws(() => checkPolicy(altered, cohorts[0]), undefined, label);
}
const mutationTamperChecks = [
  ['UPDATE enabled', mutation => { mutation.spec.applyTo[0].operations = ['CREATE', 'UPDATE']; }],
  ['missing opt-in', mutation => { delete mutation.spec.match.labelSelector; }],
  ['missing exception guard', mutation => { delete mutation.spec.match.labelSelector.matchExpressions; }],
  ['invented match guard', mutation => { mutation.spec.match.operations = ['CREATE']; }],
  ['missing MustExist', mutation => { mutation.spec.parameters.pathTests = []; }],
  ['ephemeral role', mutation => { mutation.spec.location = 'spec.ephemeralContainers[name:*].securityContext.allowPrivilegeEscalation'; }],
  ['broad image', mutation => { mutation.spec.location = 'spec.containers[image:*].securityContext.allowPrivilegeEscalation'; }],
];
for (const [label, change] of mutationTamperChecks) {
  const altered = structuredClone(policies[0]);
  const info = altered.properties.policyRule.then.details.mutationInfo;
  const mutation = JSON.parse(Buffer.from(info.content, 'base64'));
  change(mutation);
  info.content = Buffer.from(JSON.stringify(mutation)).toString('base64');
  assert.throws(() => checkPolicy(altered, cohorts[0]), undefined, label);
}
console.log(`PASS: ${mode}, sixteen pilot/preview definitions and sixteen explicit Mutate assignments checked`);
console.log(`PASS: ${tamperChecks.length + mutationTamperChecks.length} structural tamper controls rejected`);
console.log('STATIC ONLY: no Gatekeeper execution, admission or workload acceptance is implied');