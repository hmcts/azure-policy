# Structural checks for policy assignments under assignments/**/{assign,builtin.assign}.*.json
#
# These controls encode conventions documented in README.md ("How to create
# a new policy assignment", "What scope should I choose?") and
# .github/copilot-instructions.md: assignment files must live under
# assignments/mgmt-groups/<mg> or assignments/subscriptions/<sub-id>, and
# their scope/id must match where they live on disk.

require_relative "../libraries/policy_governance"

repo_root = input("repo_root")
assignment_files = PolicyGovernance.assignment_files(repo_root)

if assignment_files.empty?
  control "policy-assignments-present" do
    impact 1.0
    title "At least one policy assignment exists"
    desc "Guards against the glob pattern silently matching nothing, e.g. due to a bad repo_root input."

    describe "assignments/**/{assign,builtin.assign}.*.json" do
      subject { assignment_files }
      it { should_not be_empty }
    end
  end
end

assignment_files.each do |file|
  relative_name = file.sub(%r{.*/assignments/}, "assignments/")

  control "policy-assignment-#{relative_name.gsub(%r{[^a-zA-Z0-9]+}, "-")}" do
    impact 1.0
    title "Policy assignment '#{relative_name}' matches repository conventions"
    desc "Validates #{file} is well-formed JSON with a scope/id consistent with its folder location."

    parsed, error = PolicyGovernance.parse_json(file)

    describe "#{file}" do
      it "is valid JSON" do
        expect(error).to be_nil
      end
    end

    next if parsed.nil?

    describe "#{file} top-level fields" do
      subject { parsed }
      it { should include("id") }
      it { should include("name") }
      it { should include("type") }
      it { should include("properties") }
    end

    describe "#{file} type" do
      subject { parsed["type"] }
      it { should cmp PolicyGovernance::POLICY_ASSIGNMENT_TYPE }
    end

    properties = parsed["properties"] || {}

    describe "#{file} properties" do
      subject { properties }
      it { should include("displayName") }
      it { should include("policyDefinitionId") }
      it { should include("scope") }
    end

    scope = properties["scope"]

    if scope && parsed["id"]
      describe "#{file} id/scope coherence" do
        it "id starts with the assignment scope" do
          expect(parsed["id"]).to match(/\A#{Regexp.escape(scope)}/)
        end
      end
    end

    if scope && PolicyGovernance.mgmt_group_assignment?(file)
      describe "#{file} management-group scope" do
        subject { scope }
        it "targets a management group" do
          expect(subject).to match(%r{\A/providers/Microsoft\.Management/managementGroups/})
        end
      end
    end

    if scope && PolicyGovernance.subscription_assignment?(file)
      sub_id = PolicyGovernance.subscription_id_from_path(file)

      describe "#{file} subscription scope" do
        subject { scope }
        it "targets a subscription" do
          expect(subject).to match(%r{\A/subscriptions/})
        end

        it "matches the subscription id in its folder path" do
          expect(subject).to include(sub_id) if sub_id
        end
      end
    end
  end
end
