# Structural checks for policy definitions under policies/*/policy.json.
#
# These controls encode the conventions documented in README.md
# ("How to create a new policy definition") and in
# .github/copilot-instructions.md: one policy.json per policy directory,
# with a matching id/name/type shape expected by Azure Policy.

require_relative "../libraries/policy_governance"

repo_root = input("repo_root")
policy_files = PolicyGovernance.policy_definition_files(repo_root)

if policy_files.empty?
  control "policy-definitions-present" do
    impact 1.0
    title "At least one policy definition exists"
    desc "Guards against the glob pattern silently matching nothing, e.g. due to a bad repo_root input."

    describe "policies/*/policy.json" do
      subject { policy_files }
      it { should_not be_empty }
    end
  end
end

policy_files.each do |file|
  policy_name = File.basename(File.dirname(file))

  control "policy-definition-#{policy_name}" do
    impact 1.0
    title "Policy definition '#{policy_name}' matches repository conventions"
    desc "Validates #{file} is well-formed JSON with the fields Azure Policy and this repo's tooling require."

    parsed, error = PolicyGovernance.parse_json(file)

    describe "#{file}" do
      it "is valid JSON" do
        expect(error).to be_nil
      end
    end

    unless parsed.nil?
      describe "#{file} top-level fields" do
        subject { parsed }
        it { should include("id") }
        it { should include("name") }
        it { should include("type") }
        it { should include("properties") }
      end

      describe "#{file} type" do
        subject { parsed["type"] }
        it { should cmp PolicyGovernance::POLICY_DEFINITION_TYPE }
      end

      properties = parsed["properties"] || {}

      describe "#{file} properties" do
        subject { properties }
        it { should include("displayName") }
        it { should include("policyType") }
        it { should include("mode") }
        it { should include("policyRule") }
      end

      if parsed["id"] && parsed["name"]
        describe "#{file} id/name coherence" do
          subject { parsed["id"] }
          it "ends with the policy definition name" do
            expect(subject).to match(%r{/#{Regexp.escape(parsed["name"])}\z})
          end
        end
      end
    end
  end
end
