import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const subscription = '/subscriptions/b72ab7b7-723f-4b18-b6f6-03b0f2c6a1bb';
const cluster = `${subscription}/resourceGroups/cft-sbox-01-rg/providers/Microsoft.ContainerService/managedClusters/cft-sbox-01-aks`;
const baseRef = process.env.DTSPO_BASE_REF;
const modules = process.env.DTSPO_JSON_MODULES;
assert.ok(baseRef, 'Set DTSPO_BASE_REF to the immutable PR base commit');
assert.ok(modules && existsSync(join(modules, 'json', 'package.json')), 'Set DTSPO_JSON_MODULES to isolated json@11.0.0 node_modules');
assert.equal(JSON.parse(readFileSync(join(modules, 'json', 'package.json'))).version, '11.0.0');

function execute(command, args, options = {}) {
  const result = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, `${command}: ${result.error ?? result.stderr?.toString().slice(-4000)}`);
  return result.stdout;
}

function jsonFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? jsonFiles(path) : entry.name.endsWith('.json') ? [path] : [];
  });
}

function generatedOutput(directory) {
  const sandbox = join(directory, 'Sandbox');
  return new Map(jsonFiles(sandbox).map(path => [relative(sandbox, path), JSON.parse(readFileSync(path))]));
}

function mutation(policy) {
  return JSON.parse(Buffer.from(policy.properties.policyRule.then.details.mutationInfo.content, 'base64'));
}

const temporary = mkdtempSync(join(tmpdir(), 'dtspo35033-deployment-'));
try {
  const base = join(temporary, 'base');
  const candidate = join(temporary, 'candidate');
  const commit = execute('git', ['-C', root, 'rev-parse', '--verify', `${baseRef}^{commit}`]).toString().trim();
  const archive = execute('git', ['-C', root, 'archive', commit, 'policies', 'assignments', 'pipeline-scripts/sandbox-override.sh']);
  cpSync(join(root, 'pipeline-scripts'), join(candidate, 'pipeline-scripts'), { recursive: true });
  cpSync(join(root, 'policies'), join(candidate, 'policies'), { recursive: true });
  cpSync(join(root, 'assignments'), join(candidate, 'assignments'), { recursive: true });
  cpSync(join(candidate, 'pipeline-scripts'), join(base, 'pipeline-scripts'), { recursive: true });
  execute('tar', ['-x', '-C', base], { input: archive });
  for (const directory of [base, candidate]) {
    symlinkSync(resolve(modules), join(directory, 'node_modules'), 'dir');
    execute('bash', ['pipeline-scripts/sandbox-override.sh'], {
      cwd: directory,
      env: { ...process.env, SUB: subscription, ENVIRONMENT: 'Sandbox', npm_config_offline: 'true' },
    });
  }

  const before = generatedOutput(base);
  const after = generatedOutput(candidate);
  const owned = path => path.startsWith('policies/HMCTSNoPrivEsc')
    || basename(path).startsWith('assign.privilege-escalation-');
  for (const [path, resource] of before) {
    assert.ok(after.has(path), `Existing sandbox output removed: ${path}`);
    if (!owned(path)) assert.deepEqual(after.get(path), resource, `Unrelated sandbox output changed: ${path}`);
  }
  for (const path of after.keys()) {
    assert.ok(before.has(path) || owned(path), `Unrelated sandbox output added: ${path}`);
  }

  const assignments = [...after.values()].filter(resource =>
    resource.type === 'Microsoft.Authorization/policyAssignments'
    && resource.properties.policyDefinitionId.includes('/HMCTSNoPrivEsc'));
  assert.equal(assignments.length, 8, 'Sandbox must contain exactly eight mutation assignments');
  assert.equal(new Set(assignments.map(assignment => assignment.properties.policyDefinitionId)).size, 8);
  const definitions = [...after.values()].filter(resource => resource.type === 'Microsoft.Authorization/policyDefinitions');
  const originals = jsonFiles(join(root, 'assignments')).filter(path => basename(path).startsWith('assign.privilege-escalation-'));
  assert.equal(originals.length, 16, 'Normal deployment must include both eight-assignment stage sets');
  const expectedPilotAssignments = new Map(originals.filter(path => path.includes('privilege-escalation-pilot-'))
    .map(path => {
      const original = JSON.parse(readFileSync(path));
      return [`${original.name}_Sandbox`, original];
    }));
  assert.equal(expectedPilotAssignments.size, 8);
  for (const assignment of assignments) {
    const original = expectedPilotAssignments.get(assignment.name);
    assert.ok(original, `Unexpected or preview assignment in sandbox: ${assignment.name}`);
    assert.equal(assignment.properties.scope, subscription);
    assert.equal(assignment.id, `${subscription}/providers/Microsoft.Authorization/policyAssignments/${assignment.name}`);
    assert.equal(assignment.properties.policyDefinitionId,
      `${subscription}/providers/Microsoft.Authorization/policyDefinitions/${original.properties.policyDefinitionId.split('/').pop()}Sandbox`);
    assert.deepEqual(assignment.properties.parameters, { effect: { value: 'Mutate' } });
    assert.equal(assignment.properties.enforcementMode, 'Default');
    assert.deepEqual(assignment.properties.notScopes, original.properties.notScopes);
    const policy = definitions.find(resource => resource.id === assignment.properties.policyDefinitionId);
    assert.ok(policy, 'Every sandbox assignment must resolve to a generated sandbox definition');
    assert.deepEqual(policy.properties.policyRule.if.allOf, [
      { field: 'type', equals: 'Microsoft.ContainerService/managedClusters' },
      { field: 'id', equals: cluster },
    ]);
    assert.deepEqual(policy.properties.policyRule.then.details.namespaces, ['dtspo-35033-mutation-pilot']);
    assert.deepEqual(mutation(policy).spec.match.labelSelector, {
      matchLabels: { 'hmcts.net/mutation-pilot': 'dtspo-35033' },
      matchExpressions: [{
        key: 'hmcts.net/privilege-escalation-exception', operator: 'NotIn', values: ['approved'],
      }],
    });
  }
  const previews = definitions.filter(resource => resource.name.startsWith('HMCTSNoPrivEscPreview'));
  assert.equal(previews.length, 8);
  assert.ok(previews.every(policy => !assignments.some(assignment => assignment.properties.policyDefinitionId === policy.id)),
    'Copied preview definitions must remain unassigned in sandbox');
  const audit = 'assignments/mgmt-groups/mg-HMCTS/assign.aks.not_allow_con_esc.json';
  assert.equal(readFileSync(join(candidate, audit), 'utf8'), readFileSync(join(base, audit), 'utf8'), 'Existing Audit assignment changed');
  console.log(`PASS: unmodified sandbox scripts compared with base ${commit}`);
  console.log('PASS: eight active pilot bindings, zero preview bindings, sixteen normal-deployment assignments');
  console.log('PASS: exact pilot cluster, namespace and label retained, unrelated output and Audit unchanged');
  console.log('LOCAL OUTPUT ONLY: targeting, Azure admission and application acceptance are separate gates');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}