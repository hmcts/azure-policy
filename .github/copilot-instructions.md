# Copilot instructions for this repo

## Repository overview

This repository stores Azure Policy definitions and assignments for the HMCTS Azure estate.

- Policy definitions live under `policies/<policy-name>/policy.json`
- Assignments live under `assignments/{mgmt-groups,subscriptions}/...`
- The GitHub workflow in `.github/workflows/manage-azure-policy.yml` deploys policy definitions and assignments to Azure
- Pull requests use `pipeline-scripts/sandbox-override.sh` to create temporary `Sandbox/**` copies of policies and assignments for validation in a sandbox subscription

The repo is mostly declarative Azure Policy JSON and shell scripts, not application code. Most changes are either new/updated `policy.json` files or assignment JSON files that target a management group or subscription.

## Validation and local checks

The repo's CI validation is defined in `.github/workflows/lint.yml`:

- GitHub Actions runs on push and pull request
- The workflow executes `GrantBirki/json-yaml-validate` against the repo
- This is the main lint/validation gate for JSON/YAML changes

There is also a local-only Inspec test harness at `test/inspec/policy-governance`
that runs deeper structural checks (required fields, id/scope coherence,
management-group vs. subscription scope conventions) against every
`policies/**/policy.json` and `assignments/**/assign*.json` file. It is not
yet wired into CI (see README.md "Local policy tests with Inspec" for setup
and usage, including how to run a single control). Run it locally before a
PR touching policy or assignment files:

```bash
./test/inspec/run.sh                                   # run all controls
./test/inspec/run.sh --controls policy-definition-tagging  # single control
```

**Inspec version constraint:** use `inspec-bin` **4.56.20**, not the latest
7.x release. Inspec 7.x bundles the newer `chef-licensing` gem, which always
calls out to a Chef license server on every run — even with
`--chef-license accept-no-persist` — and fails with
`ERROR: Unable to connect to the licensing server` in restricted/offline
networks. Inspec 4.56.20 uses the older `license-acceptance` gem, which only
requires a local EULA acceptance and makes no network call by default:

```bash
gem install inspec-bin -v 4.56.20 --no-document
```

If a fully current release is required, use **CINC Auditor** instead of
Chef Inspec — it is DSL-compatible with the profile in this repo and has no
Chef license requirement at any version.

For a targeted single-file JSON sanity check, use a JSON validator on the specific file rather than trying to run a full project suite. Examples:

```bash
python -m json.tool policies/tagging/policy.json >/dev/null
python -m json.tool assignments/mgmt-groups/mg-HMCTS/assign.tagging.json >/dev/null
```

If you need to validate generated sandbox files, use the same pattern against the relevant JSON file before committing.

## High-level architecture and workflow

The repo has two primary data types:

1. Policy definitions
   - Stored in `policies/<name>/policy.json`
   - Each policy definition has a unique Azure Policy `id`, `name`, and `type`
   - The repo convention is one folder per policy name, with the definition file always named `policy.json`

2. Policy assignments
   - Stored in `assignments/mgmt-groups/<mg-group>/` for management-group scope
   - Stored in `assignments/subscriptions/<subscription-id>/` for subscription scope
   - Assignment files are named like `assign.<policy-name>.json`
   - Built-in Azure policies use the special `builtin.assign.*.json` naming pattern so the sandbox script does not overwrite the built-in `policyDefinitionId`

The deployment flow is:

- `manage-azure-policy.yml` triggers on push to `master` and on pull requests
- On `master`, it applies `policies/**` and either `assignments/subscriptions/**` or `assignments/mgmt-groups/**` to live Azure scopes
- For pull requests, the sandbox script rewrites policy names and assignment IDs to a sandbox subscription and applies `Sandbox/**` instead of the live files

## Key conventions specific to this repo

- Do not hand-edit generated sandbox output; it is created by `pipeline-scripts/sandbox-override.sh`
- Keep the policy directory and file naming aligned with the policy name: `policies/<name>/policy.json`
- For assignment files, match the scope in the path to the resource target:
  - management group: `assignments/mgmt-groups/...`
  - subscription: `assignments/subscriptions/...`
- Preserve Azure Policy metadata conventions when editing files:
  - `properties.displayName`
  - `properties.policyDefinitionId`
  - `id`
  - `name`
  - `type`
- Policy assignment IDs and names are scoped to the Azure target and often include environment-specific suffixes or management-group names
- When testing a new policy, prefer a sandbox assignment under the appropriate sandbox management group or subscription before promoting the same pattern to live assignments
- The repo intentionally contains a mixture of custom and built-in policy assignments; built-in assignments require the non-custom `policyDefinitionId` behavior and the separate `builtin.assign.*` naming convention

## When editing policy files

- Keep JSON syntactically valid and aligned with Azure Policy schema expectations
- Maintain the existing `properties` structure rather than introducing ad hoc wrappers
- Match the naming and path conventions used by neighboring policies in the same directory
- If a policy uses `deployIfNotExists`, treat role assignments/identity permissions as part of the change and keep the surrounding README guidance in mind

## When editing assignments

- Ensure the `scope` and assignment `id` match the target management group or subscription
- Use the correct file location for the intended scope; repository automation processes only the expected paths
- Preserve the file naming pattern so automated scripts and PR workflows continue to detect the assignment
