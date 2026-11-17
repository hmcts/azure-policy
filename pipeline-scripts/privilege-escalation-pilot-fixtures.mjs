import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const namespace = 'dtspo-35033-mutation-pilot';
const phases = ['prepare', 'baseline', 'mutated', 'recovery'];
const owner = { 'app.kubernetes.io/part-of': 'dtspo-35033-pilot' };

function cohorts() {
  return readdirSync(resolve(root, 'policies')).filter(name => name.startsWith('HMCTSNoPrivEscPilot')).map(name => {
    const policy = JSON.parse(readFileSync(resolve(root, 'policies', name, 'policy.json')));
    const mutation = JSON.parse(Buffer.from(policy.properties.policyRule.then.details.mutationInfo.content, 'base64'));
    const match = /^spec\.(containers|initContainers)\[image:(".*")\]\.securityContext.allowPrivilegeEscalation$/.exec(mutation.spec.location);
    assert.ok(match, `Unsupported fixture selection: ${name}`);
    return { name: name.replace('HMCTSNoPrivEscPilot', ''), role: match[1], image: JSON.parse(match[2]) };
  });
}

function labels(cohort) {
  return { ...owner, 'hmcts.net/pilot-cohort': cohort.name.toLowerCase() };
}

function resource(kind, name, cohort, spec, apiVersion = 'v1') {
  return { apiVersion, kind, metadata: { name, namespace, labels: labels(cohort) }, spec };
}

function claim(name, cohort) {
  return resource('PersistentVolumeClaim', name, cohort, {
    accessModes: ['ReadWriteOnce'], storageClassName: 'managed-csi',
    resources: { requests: { storage: '4Gi' } },
  });
}

function service(name, cohort, port) {
  return resource('Service', name, cohort, {
    type: 'ClusterIP', selector: { ...labels(cohort), 'hmcts.net/pilot-component': name },
    ports: [{ name: 'http', port, targetPort: port }],
  });
}

function stateful(name, cohort, phase, container, volumes, initContainers = []) {
  const podLabels = { ...labels(cohort), 'hmcts.net/pilot-component': name };
  return resource('StatefulSet', name, cohort, {
    serviceName: name, replicas: 1,
    selector: { matchLabels: { ...labels(cohort), 'hmcts.net/pilot-component': name } },
    template: {
      metadata: {
        labels: { ...podLabels, ...(phase === 'baseline' ? {} : { 'hmcts.net/mutation-pilot': 'dtspo-35033' }) },
        annotations: { 'hmcts.net/pilot-phase': phase },
      },
      spec: {
        automountServiceAccountToken: false,
        nodeSelector: { 'kubernetes.io/os': 'linux' },
        securityContext: { runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000 },
        containers: [container], ...(initContainers.length ? { initContainers } : {}), volumes,
      },
    },
  }, 'apps/v1');
}

function security(allowPrivilegeEscalation) {
  return { allowPrivilegeEscalation, capabilities: { drop: ['ALL'] } };
}

function config(name, cohort, data) {
  return { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name, namespace, labels: labels(cohort) }, data };
}

function jdbcResources(cohort, phase, options) {
  assert.match(options.jdbcSha256 ?? '', /^[a-f0-9]{64}$/, 'Set DTSPO_JDBC_SHA256 to the approved driver SHA256');
  const toolsImage = options.toolsImage ?? 'busybox:1.37.0';
  const postgresImage = options.postgresImage ?? 'postgres:16.4';
  assert.ok(!cohorts().some(candidate => [toolsImage, postgresImage].includes(candidate.image)), 'Support images must not be mutation targets');
  const name = `dtspo35033-${cohort.name.toLowerCase()}`;
  const assets = `${name}-assets`;
  const resources = [
    claim(`${assets}-data`, cohort), service(assets, cohort, 8080),
    stateful(assets, cohort, 'prepare', {
      name: 'assets', image: toolsImage, securityContext: security(false),
      command: ['httpd', '-f', '-p', '8080', '-h', '/files'],
      ports: [{ containerPort: 8080 }],
      readinessProbe: { tcpSocket: { port: 8080 }, periodSeconds: 2 },
      resources: { requests: { cpu: '25m', memory: '32Mi' }, limits: { cpu: '250m', memory: '64Mi' } },
      volumeMounts: [{ name: 'files', mountPath: '/files' }],
    }, [{ name: 'files', persistentVolumeClaim: { claimName: `${assets}-data` } }]),
  ];
  const download = {
    name: 'download-postgres-jdbc', image: 'hmctsprod.azurecr.io/curl:7.70.0',
    securityContext: security(true),
    command: ['/bin/sh', '-ec', [
      'grep "^NoNewPrivs:" /proc/self/status',
      `curl --fail --show-error --retry 5 --connect-timeout 10 --max-time 60 http://${assets}:8080/postgresql.jar --output /jdbc/postgresql.jar`,
      `echo '${options.jdbcSha256}  /jdbc/postgresql.jar' | sha256sum -c -`,
    ].join('\n')],
    resources: { requests: { cpu: '25m', memory: '32Mi' }, limits: { cpu: '250m', memory: '64Mi' } },
    volumeMounts: [{ name: 'jdbc', mountPath: '/jdbc' }],
  };
  if (cohort.role === 'initContainers') {
    if (phase !== 'prepare') {
      resources.push(service(name, cohort, 8080), stateful(name, cohort, phase, {
        name: 'verify-download', image: toolsImage, securityContext: security(false),
        command: ['/bin/sh', '-ec', 'sha256sum /jdbc/postgresql.jar; exec tail -f /dev/null'],
        resources: { requests: { cpu: '25m', memory: '32Mi' }, limits: { cpu: '250m', memory: '64Mi' } },
        readinessProbe: { exec: { command: ['/bin/sh', '-ec', 'test -s /jdbc/postgresql.jar'] } },
        volumeMounts: [{ name: 'jdbc', mountPath: '/jdbc', readOnly: true }],
      }, [{ name: 'jdbc', emptyDir: {} }], [download]));
    }
    return resources;
  }
  const database = `${name}-pg`;
  resources.push(claim(`${database}-data`, cohort), service(database, cohort, 5432),
    config(`${database}-seed`, cohort, {
      'init.sql': "CREATE TABLE IF NOT EXISTS pilot_events (id integer PRIMARY KEY, message text NOT NULL);\nCREATE TABLE IF NOT EXISTS pilot_retention (id integer PRIMARY KEY, token text NOT NULL);\nINSERT INTO pilot_events VALUES (1, 'dtspo35033-one'), (2, 'dtspo35033-two') ON CONFLICT DO NOTHING;\n",
    }));
  const postgres = stateful(database, cohort, 'prepare', {
    name: 'postgres', image: postgresImage, securityContext: security(false),
    env: [
      { name: 'POSTGRES_DB', value: 'pilot' },
      { name: 'POSTGRES_HOST_AUTH_METHOD', value: 'trust' },
      { name: 'PGDATA', value: '/var/lib/postgresql/data/pgdata' },
    ],
    ports: [{ containerPort: 5432 }],
    resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '1', memory: '1Gi' } },
    readinessProbe: { exec: { command: ['pg_isready', '-U', 'postgres', '-d', 'pilot'] }, periodSeconds: 5 },
    volumeMounts: [
      { name: 'data', mountPath: '/var/lib/postgresql/data' },
      { name: 'seed', mountPath: '/docker-entrypoint-initdb.d', readOnly: true },
    ],
  }, [
    { name: 'data', persistentVolumeClaim: { claimName: `${database}-data` } },
    { name: 'seed', configMap: { name: `${database}-seed` } },
  ]);
  Object.assign(postgres.spec.template.spec.securityContext, { runAsUser: 999, runAsGroup: 999, fsGroup: 999 });
  resources.push(postgres, claim(`${name}-data`, cohort));
  if (phase !== 'prepare') {
    resources.push(config(`${name}-pipeline`, cohort, {
      'pilot.conf': `input { jdbc {\n  jdbc_driver_library => "/jdbc/postgresql.jar"\n  jdbc_driver_class => "org.postgresql.Driver"\n  jdbc_connection_string => "jdbc:postgresql://${database}:5432/pilot"\n  jdbc_user => "postgres"\n  jdbc_password => ""\n  statement => "SELECT id, message, '${phase}' AS phase, (SELECT token FROM pilot_retention WHERE id = 1) AS retention_token FROM pilot_events ORDER BY id"\n  schedule => "* * * * *"\n} }\noutput { file { path => "/state/${phase}.ndjson" codec => json_lines } stdout { codec => json_lines } }\n`,
      'logstash.yml': 'path.data: /state\nqueue.type: persisted\npipeline.workers: 1\n',
    }), service(name, cohort, 9600), stateful(name, cohort, phase, {
      name: 'logstash', image: cohort.image, securityContext: security(true),
      env: [{ name: 'LS_JAVA_OPTS', value: '-Xms512m -Xmx512m' }],
      resources: { requests: { cpu: '500m', memory: '1Gi' }, limits: { cpu: '2', memory: '2Gi' } },
      readinessProbe: { exec: { command: ['/bin/sh', '-ec', `test -s /state/${phase}.ndjson`] }, initialDelaySeconds: 30, periodSeconds: 10 },
      volumeMounts: [
        { name: 'state', mountPath: '/state' }, { name: 'jdbc', mountPath: '/jdbc', readOnly: true },
        { name: 'pipeline', mountPath: '/usr/share/logstash/pipeline' },
        { name: 'settings', mountPath: '/usr/share/logstash/config/logstash.yml', subPath: 'logstash.yml' },
      ],
    }, [
      { name: 'state', persistentVolumeClaim: { claimName: `${name}-data` } }, { name: 'jdbc', emptyDir: {} },
      { name: 'pipeline', configMap: { name: `${name}-pipeline`, items: [{ key: 'pilot.conf', path: 'pilot.conf' }] } },
      { name: 'settings', configMap: { name: `${name}-pipeline`, items: [{ key: 'logstash.yml', path: 'logstash.yml' }] } },
    ], [download]));
  }
  return resources;
}

function build(cohort, phase, options = {}) {
  assert.ok(phases.includes(phase), 'Unknown fixture phase');
  const cohortLabels = labels(cohort);
  const items = [
    { apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespace, labels: owner } },
    resource('NetworkPolicy', 'dtspo35033-isolation', cohort, {
      podSelector: {}, policyTypes: ['Ingress', 'Egress'], ingress: [], egress: [],
    }, 'networking.k8s.io/v1'),
    resource('NetworkPolicy', `dtspo35033-${cohort.name.toLowerCase()}-internal`, cohort, {
      podSelector: { matchLabels: cohortLabels }, policyTypes: ['Ingress', 'Egress'],
      ingress: [{ from: [{ podSelector: { matchLabels: cohortLabels } }] }],
      egress: [
        { to: [{ podSelector: { matchLabels: cohortLabels } }] },
        {
          to: [{
            namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } },
            podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } },
          }],
          ports: [{ protocol: 'UDP', port: 53 }, { protocol: 'TCP', port: 53 }],
        },
      ],
    }, 'networking.k8s.io/v1'),
  ];
  items.push(resource('ResourceQuota', 'dtspo35033-fixture-budget', cohort, {
    hard: { pods: '6', 'requests.cpu': '3', 'requests.memory': '6Gi', 'limits.cpu': '6', 'limits.memory': '8Gi', 'requests.storage': '16Gi', persistentvolumeclaims: '4' },
  }));
  if (!cohort.image.includes('/elasticsearch:')) {
    items.push(...jdbcResources(cohort, phase, options));
    return { apiVersion: 'v1', kind: 'List', items };
  }
  const name = `dtspo35033-${cohort.name.toLowerCase()}`;
  items.push(claim(`${name}-data`, cohort), service(name, cohort, 9200));
  if (phase !== 'prepare') {
    items.push(stateful(name, cohort, phase, {
      name: 'elasticsearch', image: cohort.image, securityContext: security(true),
      env: [
        { name: 'discovery.type', value: 'single-node' },
        { name: 'xpack.security.enabled', value: 'false' },
        { name: 'node.store.allow_mmap', value: 'false' },
        { name: 'ES_JAVA_OPTS', value: '-Xms512m -Xmx512m' },
      ],
      ports: [{ containerPort: 9200 }],
      resources: { requests: { cpu: '500m', memory: '1Gi' }, limits: { cpu: '2', memory: '2Gi' } },
      readinessProbe: { httpGet: { path: '/_cluster/health', port: 9200 }, initialDelaySeconds: 20, periodSeconds: 10 },
      volumeMounts: [{ name: 'data', mountPath: '/usr/share/elasticsearch/data' }],
    }, [{ name: 'data', persistentVolumeClaim: { claimName: `${name}-data` } }]));
  }
  return { apiVersion: 'v1', kind: 'List', items };
}

function checkFixture(fixture, cohort, phase) {
  const expectedLabels = labels(cohort);
  const targetImages = cohorts();
  for (const item of fixture.items) {
    if (item.kind === 'Namespace') {
      assert.equal(item.metadata.name, namespace);
      continue;
    }
    assert.equal(item.metadata.namespace, namespace);
    assert.ok(item.metadata.name.startsWith('dtspo35033-'));
    if (item.kind === 'PersistentVolumeClaim') {
      assert.equal(item.spec.volumeName, undefined);
      assert.equal(item.spec.selector, undefined);
    }
    if (item.kind === 'Service') {
      assert.equal(item.spec.type, 'ClusterIP');
      assert.equal(item.spec.externalIPs, undefined);
      assert.equal(item.spec.externalName, undefined);
    }
    if (item.kind === 'NetworkPolicy' && item.metadata.name.endsWith('-internal')) {
      assert.deepEqual(item.spec.podSelector, { matchLabels: expectedLabels });
      assert.deepEqual(item.spec.ingress, [{ from: [{ podSelector: { matchLabels: expectedLabels } }] }]);
      assert.deepEqual(item.spec.egress, [
        { to: [{ podSelector: { matchLabels: expectedLabels } }] },
        {
          to: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } } }],
          ports: [{ protocol: 'UDP', port: 53 }, { protocol: 'TCP', port: 53 }],
        },
      ]);
    }
    if (item.kind !== 'StatefulSet') continue;
    assert.equal(item.spec.replicas, 1);
    const pod = item.spec.template;
    const targetPod = ['containers', 'initContainers'].some(role =>
      (pod.spec[role] ?? []).some(container => targetImages.some(target => target.role === role && target.image === container.image)));
    const expectedPhase = targetPod ? phase : 'prepare';
    assert.equal(pod.metadata.annotations['hmcts.net/pilot-phase'], expectedPhase);
    assert.equal(pod.metadata.labels['hmcts.net/mutation-pilot'], expectedPhase === 'baseline' ? undefined : 'dtspo-35033');
    assert.equal(pod.metadata.labels['hmcts.net/privilege-escalation-exception'], undefined);
    assert.equal(pod.spec.automountServiceAccountToken, false);
    assert.deepEqual(pod.spec.nodeSelector, { 'kubernetes.io/os': 'linux' });
    for (const flag of ['hostNetwork', 'hostPID', 'hostIPC']) assert.ok(!pod.spec[flag]);
    for (const volume of pod.spec.volumes) {
      assert.equal(volume.hostPath, undefined);
      if (volume.persistentVolumeClaim) assert.ok(volume.persistentVolumeClaim.claimName.startsWith(`dtspo35033-${cohort.name.toLowerCase()}-`));
    }
    for (const role of ['containers', 'initContainers']) {
      for (const container of pod.spec[role] ?? []) {
        const selected = targetImages.some(target => target.role === role && target.image === container.image);
        assert.equal(container.securityContext.allowPrivilegeEscalation, selected);
        assert.ok(!container.securityContext.privileged);
        assert.deepEqual(container.securityContext.capabilities, { drop: ['ALL'] });
        if (role === 'containers' && selected) {
          assert.equal(container.command, undefined);
          assert.equal(container.args, undefined);
        }
      }
    }
  }
  const deny = fixture.items.find(item => item.kind === 'NetworkPolicy' && item.metadata.name === 'dtspo35033-isolation');
  assert.deepEqual(deny.spec, { podSelector: {}, policyTypes: ['Ingress', 'Egress'], ingress: [], egress: [] });
}

function checkEvidence(kind, content, cohort, phase, runId = process.env.DTSPO_PILOT_RUN_ID) {
  assert.ok(['baseline', 'mutated', 'recovery'].includes(phase), 'Evidence requires a workload phase');
  if (kind === '--check-pod') {
    const pod = JSON.parse(content);
    assert.equal(pod.kind, 'Pod');
    assert.equal(pod.metadata.name, `dtspo35033-${cohort.name.toLowerCase()}-0`);
    assert.equal(pod.metadata.namespace, namespace);
    for (const [key, value] of Object.entries(owner)) assert.equal(pod.metadata.labels[key], value);
    assert.equal(pod.metadata.labels['hmcts.net/pilot-cohort'], cohort.name.toLowerCase());
    assert.equal(pod.metadata.annotations['hmcts.net/pilot-phase'], phase);
    assert.equal(pod.metadata.labels['hmcts.net/privilege-escalation-exception'], undefined);
    assert.equal(pod.metadata.labels['hmcts.net/mutation-pilot'], phase === 'baseline' ? undefined : 'dtspo-35033');
    assert.ok(pod.metadata.uid, 'Record the actual admitted Pod UID');
    assert.equal(pod.metadata.deletionTimestamp, undefined);
    assert.equal(pod.status.phase, 'Running');
    assert.equal(pod.spec.automountServiceAccountToken, false);
    assert.deepEqual(pod.spec.nodeSelector, { 'kubernetes.io/os': 'linux' });
    assert.equal(pod.spec.securityContext.runAsNonRoot, true);
    assert.equal(pod.spec.securityContext.runAsUser, 1000);
    for (const flag of ['hostNetwork', 'hostPID', 'hostIPC']) assert.ok(!pod.spec[flag]);
    assert.equal((pod.spec.ephemeralContainers ?? []).length, 0);
    const name = `dtspo35033-${cohort.name.toLowerCase()}`;
    const expectedVolumes = cohort.image.includes('/elasticsearch:') ? { data: 'persistentVolumeClaim' }
      : cohort.role === 'initContainers' ? { jdbc: 'emptyDir' }
        : { state: 'persistentVolumeClaim', jdbc: 'emptyDir', pipeline: 'configMap', settings: 'configMap' };
    assert.deepEqual((pod.spec.volumes ?? []).map(volume => volume.name).sort(), Object.keys(expectedVolumes).sort());
    for (const volume of pod.spec.volumes) {
      const kind = expectedVolumes[volume.name];
      assert.deepEqual(Object.keys(volume).sort(), ['name', kind].sort(), 'Unexpected volume source');
      if (kind === 'persistentVolumeClaim') {
        assert.equal(volume.persistentVolumeClaim.claimName, `${name}-data`);
        assert.ok(!volume.persistentVolumeClaim.readOnly);
      }
      if (kind === 'configMap') assert.equal(volume.configMap.name, `${name}-pipeline`);
    }
    assert.equal(pod.spec.containers.length, 1, 'Review any injected or additional regular container');
    assert.equal((pod.spec.initContainers ?? []).length, cohort.image.includes('/elasticsearch:') ? 0 : 1,
      'Review any injected or additional init container');
    let targetFound = false;
    for (const role of ['containers', 'initContainers']) {
      for (const container of pod.spec[role] ?? []) {
        const selected = cohorts().some(target => target.role === role && target.image === container.image);
        assert.equal(container.securityContext.allowPrivilegeEscalation, selected && phase !== 'mutated');
        assert.ok(!container.securityContext.privileged);
        assert.deepEqual(container.securityContext.capabilities, { drop: ['ALL'] });
        assert.equal(container.securityContext.runAsUser, undefined);
        targetFound ||= role === cohort.role && container.image === cohort.image;
        const statusRole = role === 'containers' ? 'containerStatuses' : 'initContainerStatuses';
        const status = pod.status[statusRole]?.find(candidate => candidate.name === container.name);
        assert.match(status?.imageID ?? '', /(?:@|:\/\/|^)sha256:[a-f0-9]{64}$/, 'Record the resolved runtime image digest');
        assert.equal(status.restartCount, 0, 'Investigate fixture restarts before acceptance');
        if (role === 'containers') assert.equal(status.ready, true);
        else assert.equal(status.state.terminated.exitCode, 0);
      }
    }
    assert.ok(targetFound, 'Expected cohort image and role were not admitted');
  } else if (cohort.image.includes('/elasticsearch:')) {
    assert.match(runId ?? '', /^[a-zA-Z0-9-]{8,80}$/, 'Set DTSPO_PILOT_RUN_ID to the unique recorded run identifier');
    const result = JSON.parse(content);
    assert.equal(result.timed_out, false);
    assert.equal(result._shards.failed, 0);
    const hits = result.hits.hits;
    const expected = phase === 'baseline' ? ['1'] : ['1', '2'];
    assert.deepEqual(hits.map(hit => hit._id).sort(), expected);
    for (const hit of hits) {
      assert.equal(hit._index, 'dtspo35033-proof');
      assert.equal(hit._source.message, hit._id === '1' ? 'dtspo35033-one' : 'dtspo35033-two');
      assert.equal(hit._source.created_phase, hit._id === '1' ? 'baseline' : 'mutated');
      assert.equal(hit._source.run_id, runId);
    }
  } else {
    assert.equal(cohort.role, 'containers', 'JDBC download evidence is checked from the Pod and checksum logs');
    assert.match(runId ?? '', /^[a-zA-Z0-9-]{8,80}$/, 'Set DTSPO_PILOT_RUN_ID to the unique recorded run identifier');
    const rows = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.ok(rows.length >= 2, 'Require both seeded JDBC records');
    assert.deepEqual([...new Set(rows.map(row => row.id))].sort(), [1, 2]);
    for (const row of rows) {
      assert.equal(row.message, row.id === 1 ? 'dtspo35033-one' : 'dtspo35033-two');
      assert.equal(row.phase, phase);
      assert.equal(row.retention_token, runId);
    }
  }
}

function checkTransition(pods, cohort) {
  assert.equal(pods.length, 3);
  for (const [index, phase] of ['baseline', 'mutated', 'recovery'].entries()) {
    checkEvidence('--check-pod', JSON.stringify(pods[index]), cohort, phase);
  }
  assert.equal(new Set(pods.map(pod => pod.metadata.uid)).size, 3, 'Each phase must use a replacement Pod');
  const imageIds = pod => ['containerStatuses', 'initContainerStatuses'].flatMap(role =>
    (pod.status[role] ?? []).map(status => ({ role, name: status.name, imageID: status.imageID })))
    .sort((left, right) => `${left.role}/${left.name}`.localeCompare(`${right.role}/${right.name}`));
  for (const pod of pods.slice(1)) {
    assert.deepEqual(imageIds(pod), imageIds(pods[0]), 'Runtime image digests changed between phases');
    assert.deepEqual(pod.spec.volumes, pods[0].spec.volumes, 'Storage or configuration references changed between phases');
  }
}

function checkStorage(lists, cohort) {
  assert.equal(lists.length, 3);
  const name = `dtspo35033-${cohort.name.toLowerCase()}`;
  const expected = cohort.image.includes('/elasticsearch:') ? [`${name}-data`]
    : cohort.role === 'initContainers' ? [`${name}-assets-data`]
      : [`${name}-data`, `${name}-assets-data`, `${name}-pg-data`];
  const snapshots = lists.map(list => {
    assert.equal(list.kind, 'List');
    assert.deepEqual(list.items.map(claim => claim.metadata.name).sort(), [...expected].sort());
    return list.items.map(claim => {
      assert.equal(claim.kind, 'PersistentVolumeClaim');
      assert.equal(claim.metadata.namespace, namespace);
      assert.equal(claim.metadata.labels['hmcts.net/pilot-cohort'], cohort.name.toLowerCase());
      for (const [key, value] of Object.entries(owner)) assert.equal(claim.metadata.labels[key], value);
      assert.ok(claim.metadata.uid);
      assert.equal(claim.metadata.deletionTimestamp, undefined);
      assert.equal(claim.status.phase, 'Bound');
      assert.equal(claim.spec.storageClassName, 'managed-csi');
      assert.ok(claim.spec.volumeName);
      assert.ok(claim.status.capacity.storage);
      return { name: claim.metadata.name, uid: claim.metadata.uid, volume: claim.spec.volumeName, capacity: claim.status.capacity.storage };
    }).sort((left, right) => left.name.localeCompare(right.name));
  });
  for (const snapshot of snapshots.slice(1)) assert.deepEqual(snapshot, snapshots[0], 'PVC identity, bound volume or capacity changed between phases');
}

function selfTest() {
  assert.equal(cohorts().length, 8);
  for (const cohort of cohorts()) {
    const phasePods = [];
    for (const phase of phases) {
      const fixture = build(cohort, phase, { jdbcSha256: '1'.repeat(64) });
      checkFixture(fixture, cohort, phase);
      const workload = fixture.items.find(item => item.kind === 'StatefulSet' && item.metadata.name === `dtspo35033-${cohort.name.toLowerCase()}`);
      assert.equal(Boolean(workload), phase !== 'prepare');
      for (const item of fixture.items.filter(item => item.kind !== 'Namespace')) assert.equal(item.metadata.namespace, namespace);
      if (workload) {
        const selected = cohort.role === 'containers' ? workload.spec.template.spec.containers[0] : workload.spec.template.spec.initContainers[0];
        assert.equal(selected.image, cohort.image);
        assert.equal(selected.securityContext.allowPrivilegeEscalation, true);
        assert.equal(workload.spec.template.metadata.labels['hmcts.net/mutation-pilot'], phase === 'baseline' ? undefined : 'dtspo-35033');
        const pod = structuredClone({
          apiVersion: 'v1', kind: 'Pod',
          metadata: { ...workload.spec.template.metadata, name: `${workload.metadata.name}-0`, namespace, uid: `offline-${phase}-uid` },
          spec: workload.spec.template.spec,
          status: { phase: 'Running' },
        });
        for (const role of ['containers', 'initContainers']) {
          const statuses = [];
          for (const container of pod.spec[role] ?? []) {
            if (phase === 'mutated' && cohorts().some(target => target.role === role && target.image === container.image)) {
              container.securityContext.allowPrivilegeEscalation = false;
            }
            statuses.push({ name: container.name, imageID: `sha256:${'1'.repeat(64)}`, ready: true, restartCount: 0, state: { terminated: { exitCode: 0 } } });
          }
          pod.status[role === 'containers' ? 'containerStatuses' : 'initContainerStatuses'] = statuses;
        }
        checkEvidence('--check-pod', JSON.stringify(pod), cohort, phase);
        phasePods.push(pod);
        const restarted = structuredClone(pod);
        restarted.status.containerStatuses[0].restartCount = 1;
        assert.throws(() => checkEvidence('--check-pod', JSON.stringify(restarted), cohort, phase));
        const bypassed = structuredClone(pod);
        bypassed.metadata.labels['hmcts.net/privilege-escalation-exception'] = 'approved';
        assert.throws(() => checkEvidence('--check-pod', JSON.stringify(bypassed), cohort, phase));
        const wrongFlag = structuredClone(pod);
        const selectedContainer = wrongFlag.spec[cohort.role].find(container => container.image === cohort.image);
        selectedContainer.securityContext.allowPrivilegeEscalation = phase === 'mutated';
        assert.throws(() => checkEvidence('--check-pod', JSON.stringify(wrongFlag), cohort, phase));
        for (const change of [
          changed => { changed.spec.hostNetwork = true; },
          changed => { changed.spec.volumes.push({ name: 'host', hostPath: { path: '/' } }); },
          changed => { changed.spec.containers.push(structuredClone(changed.spec.containers[0])); },
          changed => { changed.spec.containers[0].securityContext.privileged = true; },
          changed => { changed.status.containerStatuses[0].imageID = 'unresolved:latest'; },
          changed => { changed.spec.volumes[0] = { name: changed.spec.volumes[0].name, secret: { secretName: 'business-secret' } }; },
        ]) {
          const changed = structuredClone(pod);
          change(changed);
          assert.throws(() => checkEvidence('--check-pod', JSON.stringify(changed), cohort, phase));
        }
        const businessVolume = structuredClone(pod);
        const persistent = businessVolume.spec.volumes.find(volume => volume.persistentVolumeClaim);
        if (persistent) {
          persistent.persistentVolumeClaim.claimName = 'existing-business-claim';
          assert.throws(() => checkEvidence('--check-pod', JSON.stringify(businessVolume), cohort, phase));
        }
      }
    }
    checkTransition(phasePods, cohort);
    const repeated = structuredClone(phasePods);
    repeated[1].metadata.uid = repeated[0].metadata.uid;
    assert.throws(() => checkTransition(repeated, cohort));
    const changedImage = structuredClone(phasePods);
    changedImage[1].status.containerStatuses[0].imageID = `sha256:${'2'.repeat(64)}`;
    assert.throws(() => checkTransition(changedImage, cohort));
    const claims = {
      kind: 'List',
      items: build(cohort, 'baseline', { jdbcSha256: '1'.repeat(64) }).items.filter(item => item.kind === 'PersistentVolumeClaim').map(item => ({
        ...item, metadata: { ...item.metadata, uid: `offline-${item.metadata.name}` },
        spec: { ...item.spec, volumeName: `offline-${item.metadata.name}` },
        status: { phase: 'Bound', capacity: { storage: '4Gi' } },
      })),
    };
    checkStorage([claims, claims, claims], cohort);
    for (const change of [
      list => { list.items[0].metadata.uid = 'recreated-claim'; },
      list => { list.items[0].spec.volumeName = 'replacement-volume'; },
      list => { list.items.pop(); },
    ]) {
      const changed = structuredClone(claims);
      change(changed);
      assert.throws(() => checkStorage([claims, changed, claims], cohort));
    }
  }
  for (const cohort of cohorts().filter(candidate => !candidate.image.includes('/elasticsearch:'))) {
    assert.throws(() => build(cohort, 'mutated'), /DTSPO_JDBC_SHA256/);
    assert.throws(() => build(cohort, 'mutated', { jdbcSha256: '1'.repeat(64), toolsImage: cohort.image }), /Support images/);
    const support = phase => build(cohort, phase, { jdbcSha256: '1'.repeat(64) }).items.filter(item =>
      item.kind === 'StatefulSet' && item.metadata.name !== `dtspo35033-${cohort.name.toLowerCase()}`);
    for (const phase of ['baseline', 'mutated', 'recovery']) assert.deepEqual(support(phase), support('prepare'));
  }
  const example = cohorts().find(cohort => cohort.name === 'ES923');
  for (const change of [
    fixture => { fixture.items.find(item => item.kind === 'Service').spec.type = 'LoadBalancer'; },
    fixture => { fixture.items.find(item => item.kind === 'StatefulSet').spec.template.spec.hostNetwork = true; },
    fixture => { fixture.items.find(item => item.kind === 'StatefulSet').spec.template.spec.volumes.push({ name: 'host', hostPath: { path: '/' } }); },
    fixture => { fixture.items.find(item => item.kind === 'NetworkPolicy').spec.egress = [{}]; },
    fixture => { fixture.items.find(item => item.kind === 'PersistentVolumeClaim').spec.volumeName = 'existing-business-disk'; },
    fixture => { fixture.items.find(item => item.kind === 'StatefulSet').spec.template.metadata.labels['hmcts.net/privilege-escalation-exception'] = 'approved'; },
  ]) {
    const fixture = build(example, 'mutated');
    change(fixture);
    assert.throws(() => checkFixture(fixture, example, 'mutated'));
  }
  console.log('PASS: eight component cohorts and four phases, checksum-bound JDBC, isolated data and honest recovery opt-in');
  console.log('PASS: six unsafe fixture changes rejected');
  const logstash = cohorts().find(cohort => cohort.name === 'LS924');
  const runId = 'test-fixture-run';
  const rows = [{ id: 1, message: 'dtspo35033-one', phase: 'mutated', retention_token: runId }, { id: 2, message: 'dtspo35033-two', phase: 'mutated', retention_token: runId }];
  checkEvidence('--check-results', rows.map(row => JSON.stringify(row)).join('\n'), logstash, 'mutated', runId);
  assert.throws(() => checkEvidence('--check-results', JSON.stringify(rows[0]), logstash, 'mutated', runId));
  assert.throws(() => checkEvidence('--check-results', rows.map(row => JSON.stringify({ ...row, phase: 'baseline' })).join('\n'), logstash, 'mutated', runId));
  assert.throws(() => checkEvidence('--check-results', rows.map(row => JSON.stringify({ ...row, retention_token: null })).join('\n'), logstash, 'mutated', runId));
  const elasticsearch = cohorts().find(cohort => cohort.name === 'ES923');
  const search = { timed_out: false, _shards: { failed: 0 }, hits: { hits: [
    { _index: 'dtspo35033-proof', _id: '1', _source: { message: 'dtspo35033-one', created_phase: 'baseline', run_id: runId } },
    { _index: 'dtspo35033-proof', _id: '2', _source: { message: 'dtspo35033-two', created_phase: 'mutated', run_id: runId } },
  ] } };
  checkEvidence('--check-results', JSON.stringify(search), elasticsearch, 'recovery', runId);
  assert.throws(() => checkEvidence('--check-results', JSON.stringify({ ...search, timed_out: true }), elasticsearch, 'recovery', runId));
  assert.throws(() => checkEvidence('--check-results', JSON.stringify({ ...search, hits: { hits: search.hits.hits.slice(1) } }), elasticsearch, 'recovery', runId));
  assert.throws(() => checkEvidence('--check-results', JSON.stringify(search), elasticsearch, 'recovery', 'another-fixture-run'));
  console.log('PASS: functional evidence rejects missing data, stale runs and phases, recreated databases and incomplete searches');
  console.log('PASS: cross-phase evidence requires replacement Pods, identical image digests and retained PVC identities');
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--self-test') {
  selfTest();
} else if (args.length === 1 && args[0] === '--list') {
  console.log(JSON.stringify(cohorts(), null, 2));
} else if (['--check-transition', '--check-storage'].includes(args[0])) {
  assert.equal(args.length, 6, 'Use --check-transition|--check-storage BASELINE MUTATED RECOVERY --cohort NAME');
  assert.equal(args[4], '--cohort');
  const cohort = cohorts().find(candidate => candidate.name === args[5]);
  assert.ok(cohort, 'Unknown cohort');
  const snapshots = args.slice(1, 4).map(path => JSON.parse(readFileSync(path, 'utf8')));
  if (args[0] === '--check-transition') checkTransition(snapshots, cohort);
  else checkStorage(snapshots, cohort);
  console.log(`PASS: ${cohort.name} ${args[0]}`);
} else if (['--check-pod', '--check-results'].includes(args[0])) {
  assert.equal(args.length, 6, 'Use --check-pod|--check-results FILE --cohort NAME --phase baseline|mutated|recovery');
  assert.equal(args[2], '--cohort');
  assert.equal(args[4], '--phase');
  const cohort = cohorts().find(candidate => candidate.name === args[3]);
  assert.ok(cohort, 'Unknown cohort');
  checkEvidence(args[0], readFileSync(args[1], 'utf8'), cohort, args[5]);
  console.log(`PASS: ${cohort.name} ${args[5]} ${args[0]}`);
} else {
  assert.equal(args.length, 4, 'Use --cohort NAME --phase prepare|baseline|mutated|recovery');
  assert.equal(args[0], '--cohort');
  assert.equal(args[2], '--phase');
  const cohort = cohorts().find(candidate => candidate.name === args[1]);
  assert.ok(cohort, 'Unknown cohort');
  const fixture = build(cohort, args[3], {
    jdbcSha256: process.env.DTSPO_JDBC_SHA256,
    toolsImage: process.env.DTSPO_PILOT_TOOLS_IMAGE,
    postgresImage: process.env.DTSPO_PILOT_POSTGRES_IMAGE,
  });
  checkFixture(fixture, cohort, args[3]);
  console.log(JSON.stringify(fixture, null, 2));
}