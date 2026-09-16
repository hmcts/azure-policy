require "json"

# Shared helpers for the policy-governance Inspec profile.
#
# These helpers only read files from disk relative to the `repo_root` input;
# they never call the Azure API. Keeping the logic here (rather than
# duplicating Dir.glob/JSON.parse calls in every control) keeps controls
# small and lets us unit-reason about path/scope parsing in one place.
module PolicyGovernance
  POLICY_ASSIGNMENT_TYPE = "Microsoft.Authorization/policyAssignments".freeze
  POLICY_DEFINITION_TYPE = "Microsoft.Authorization/policyDefinitions".freeze

  # Returns absolute paths to every policy definition file, e.g.
  # policies/tagging/policy.json
  def self.policy_definition_files(repo_root)
    Dir.glob(File.join(repo_root, "policies", "*", "policy.json")).sort
  end

  # Returns absolute paths to every assignment file, matching both the
  # custom `assign.*.json` and built-in `builtin.assign.*.json` naming
  # conventions described in README.md.
  def self.assignment_files(repo_root)
    Dir.glob(
      File.join(repo_root, "assignments", "**", "{assign,builtin.assign}.*.json")
    ).sort
  end

  # Parses a JSON file, returning [parsed_hash, nil] on success or
  # [nil, error_message] if the file is missing or not valid JSON. Controls
  # use this instead of raising so a single malformed file is reported as one
  # failing check rather than aborting the whole control run.
  def self.parse_json(path)
    [JSON.parse(File.read(path)), nil]
  rescue Errno::ENOENT
    [nil, "file not found: #{path}"]
  rescue JSON::ParserError => e
    [nil, "invalid JSON in #{path}: #{e.message}"]
  end

  # True when the assignment file lives under assignments/mgmt-groups/**
  def self.mgmt_group_assignment?(path)
    path.include?("#{File::SEPARATOR}assignments#{File::SEPARATOR}mgmt-groups#{File::SEPARATOR}")
  end

  # True when the assignment file lives under assignments/subscriptions/**
  def self.subscription_assignment?(path)
    path.include?("#{File::SEPARATOR}assignments#{File::SEPARATOR}subscriptions#{File::SEPARATOR}")
  end

  # True when the file name uses the `builtin.assign.*.json` convention used
  # for built-in Azure policies (see README.md "What scope should I choose?").
  def self.builtin_assignment?(path)
    File.basename(path).start_with?("builtin.assign.")
  end

  # Extracts the subscription id segment directly under
  # assignments/subscriptions/<sub_id>/... or nil if the path doesn't match.
  def self.subscription_id_from_path(path)
    match = path.match(%r{assignments/subscriptions/([^/]+)/})
    match && match[1]
  end
end
