import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const clusterId = '/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb/resourceGroups/cft-sbox-01-rg/providers/Microsoft.ContainerService/managedClusters/cft-sbox-01-aks';
const namespace = 'dtspo-35033-mutation-pilot';
const excludedNamespaces = [
  'kube-system', 'gatekeeper-system', 'azure-arc',
  'azure-extensions-usage-system', 'monitoring',
];
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

function buildPolicy([suffix, role, image]) {
  const name = `HMCTSNoPrivEscPilot${suffix}`;
  const containerPath = `spec.${role}[image:${JSON.stringify(image)}]`;
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
        namespaces: [namespace],
        excludedNamespaces,
        labelSelector: { matchLabels: { 'hmcts.net/mutation-pilot': 'dtspo-35033' } },
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
      displayName: `DTSPO-35033 privilege escalation pilot - ${suffix}`,
      policyType: 'Custom',
      mode: 'Microsoft.Kubernetes.Data',
      description: 'Disabled pilot for one reviewed image and container role. No assignment is included. Do not enable before mutation-engine and targeting acceptance.',
      metadata: { category: 'Kubernetes', version: '0.1.0', preview: true },
      parameters: {
        effect: {
          type: 'String',
          metadata: {
            displayName: 'Effect',
            description: 'Keep Disabled until the disposable pilot contract and engine checks pass.',
          },
          allowedValues: ['Mutate', 'Disabled'],
          defaultValue: 'Disabled',
        },
      },
      policyRule: {
        if: {
          allOf: [
            { field: 'type', equals: 'Microsoft.ContainerService/managedClusters' },
            { field: 'id', equals: clusterId },
          ],
        },
        then: {
          effect: "[parameters('effect')]",
          details: {
            source: 'Original',
            namespaces: [namespace],
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

function checkPolicy(policy, cohort) {
  const [suffix, role, image] = cohort;
  assert.equal(policy.name, `HMCTSNoPrivEscPilot${suffix}`);
  assert.equal(policy.id, `/providers/Microsoft.Management/managementGroups/HMCTS/providers/Microsoft.Authorization/policyDefinitions/${policy.name}`);
  assert.equal(policy.type, 'Microsoft.Authorization/policyDefinitions');
  const properties = policy.properties;
  assert.equal(properties.mode, 'Microsoft.Kubernetes.Data');
  assert.equal(properties.parameters.effect.defaultValue, 'Disabled');
  assert.deepEqual(properties.parameters.effect.allowedValues, ['Mutate', 'Disabled']);
  assert.deepEqual(properties.policyRule.if.allOf, [
    { field: 'type', equals: 'Microsoft.ContainerService/managedClusters' },
    { field: 'id', equals: clusterId },
  ]);
  const details = properties.policyRule.then.details;
  assert.deepEqual(Object.keys(details).sort(), ['excludedNamespaces', 'mutationInfo', 'namespaces', 'source']);
  assert.equal(details.source, 'Original');
  assert.deepEqual(details.namespaces, [namespace]);
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
  assert.deepEqual(mutation.spec.match.namespaces, [namespace]);
  assert.deepEqual(mutation.spec.match.excludedNamespaces, excludedNamespaces);
  assert.deepEqual(mutation.spec.match.labelSelector, {
    matchLabels: { 'hmcts.net/mutation-pilot': 'dtspo-35033' },
  });
  assert.deepEqual(Object.keys(mutation.spec.match).sort(), [
    'excludedNamespaces', 'kinds', 'labelSelector', 'namespaces', 'scope', 'source',
  ]);
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

const mode = process.argv[2] ?? '--check';
assert.ok(['--self-test', '--check', '--write'].includes(mode), 'Use --self-test, --check or --write');
const policies = cohorts.map(buildPolicy);
assert.equal(new Set(policies.map(policy => policy.name)).size, 8);
for (const [index, policy] of policies.entries()) {
  checkPolicy(policy, cohorts[index]);
  const target = resolve(root, 'policies', policy.name, 'policy.json');
  const content = `${JSON.stringify(policy, null, 2)}\n`;
  if (mode === '--write') {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  } else if (mode === '--check') {
    assert.equal(readFileSync(target, 'utf8'), content, `Generated policy differs: ${policy.name}`);
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
console.log(`PASS: ${mode}, eight disabled pilot definitions and embedded Assign structure checked`);
console.log(`PASS: ${tamperChecks.length + mutationTamperChecks.length} structural tamper controls rejected`);
console.log('STATIC ONLY: no Gatekeeper execution, admission or workload acceptance is implied');