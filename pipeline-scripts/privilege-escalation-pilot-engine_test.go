package pilot_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"

	mutations "github.com/open-policy-agent/gatekeeper/v3/apis/mutations/unversioned"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/mutators/assign"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/types"
	admissionv1 "k8s.io/api/admission/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const pilotNamespace = "dtspo-35033-mutation-pilot"

type cohort struct {
	name, role, image string
	definition        []byte
}

func loadCohorts(t *testing.T) []cohort {
	t.Helper()
	root := os.Getenv("POLICY_REPO_ROOT")
	if root == "" {
		t.Fatal("POLICY_REPO_ROOT must identify the policy repository")
	}
	paths, err := filepath.Glob(filepath.Join(root, "policies", "HMCTSNoPrivEscPilot*", "policy.json"))
	if err != nil || len(paths) != 8 {
		t.Fatalf("expected eight definitions, got %d: %v", len(paths), err)
	}
	var result []cohort
	for _, path := range paths {
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var policy struct {
			Name       string
			Properties struct {
				PolicyRule struct {
					Then struct {
						Details struct {
							MutationInfo struct{ Content string }
						}
					}
				}
			}
		}
		if err := json.Unmarshal(content, &policy); err != nil {
			t.Fatal(err)
		}
		decoded, err := base64.StdEncoding.DecodeString(policy.Properties.PolicyRule.Then.Details.MutationInfo.Content)
		if err != nil {
			t.Fatal(err)
		}
		var resource mutations.Assign
		if err := json.Unmarshal(decoded, &resource); err != nil {
			t.Fatal(err)
		}
		prefix, remainder, found := strings.Cut(resource.Spec.Location, "[image:")
		if !found || !strings.HasSuffix(remainder, "].securityContext.allowPrivilegeEscalation") {
			t.Fatalf("unexpected location: %s", resource.Spec.Location)
		}
		image, err := strconv.Unquote(strings.TrimSuffix(remainder, "].securityContext.allowPrivilegeEscalation"))
		if err != nil {
			t.Fatal(err)
		}
		result = append(result, cohort{policy.Name, strings.TrimPrefix(prefix, "spec."), image, decoded})
	}
	return result
}

func newSystem(t *testing.T, cohorts []cohort, override func(map[string]any)) *mutation.System {
	t.Helper()
	system := mutation.NewSystem(mutation.SystemOpts{})
	for _, candidate := range cohorts {
		content := candidate.definition
		if override != nil {
			var object map[string]any
			if err := json.Unmarshal(content, &object); err != nil {
				t.Fatal(err)
			}
			override(object)
			var err error
			content, err = json.Marshal(object)
			if err != nil {
				t.Fatal(err)
			}
		}
		var resource mutations.Assign
		if err := json.Unmarshal(content, &resource); err != nil {
			t.Fatal(err)
		}
		mutator, err := assign.MutatorForAssign(&resource)
		if err != nil {
			t.Fatalf("construct %s: %v", candidate.name, err)
		}
		if err := system.Upsert(mutator); err != nil {
			t.Fatalf("register %s alongside all other policies: %v", candidate.name, err)
		}
	}
	return system
}

func fixture(candidate cohort) *unstructured.Unstructured {
	object := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1", "kind": "Pod",
		"metadata": map[string]any{
			"name": "reviewed-pilot", "namespace": pilotNamespace,
			"labels": map[string]any{"hmcts.net/mutation-pilot": "dtspo-35033"},
		},
		"spec": map[string]any{
			"containers": []any{map[string]any{"name": "application", "image": "unapproved.invalid/application:1"}},
		},
	}}
	container := map[string]any{
		"name": "reviewed-container", "image": candidate.image,
		"securityContext": map[string]any{"runAsUser": int64(1000)},
	}
	object.Object["spec"].(map[string]any)[candidate.role] = []any{container}
	return object
}

func selected(object *unstructured.Unstructured, role string) map[string]any {
	return object.Object["spec"].(map[string]any)[role].([]any)[0].(map[string]any)
}

func mutate(t *testing.T, system *mutation.System, object *unstructured.Unstructured, operation admissionv1.Operation, source types.SourceType) bool {
	t.Helper()
	changed, err := system.Mutate(context.Background(), &types.Mutable{
		Object: object, Operation: operation, Source: source,
		Namespace: &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: object.GetNamespace()}},
	})
	if err != nil {
		t.Fatal(err)
	}
	return changed
}

func assertObject(t *testing.T, got, want *unstructured.Unstructured) {
	t.Helper()
	if !reflect.DeepEqual(got.Object, want.Object) {
		gotJSON, _ := json.Marshal(got)
		wantJSON, _ := json.Marshal(want)
		t.Fatalf("unexpected full Pod difference\ngot:  %s\nwant: %s", gotJSON, wantJSON)
	}
}

func TestPositiveCohortsAndIdempotence(t *testing.T) {
	cohorts := loadCohorts(t)
	system := newSystem(t, cohorts, nil)
	for _, candidate := range cohorts {
		for _, state := range []string{"absent", "true", "false", "no-security-context"} {
			t.Run(candidate.name+"/"+state, func(t *testing.T) {
				object := fixture(candidate)
				if state == "no-security-context" {
					delete(selected(object, candidate.role), "securityContext")
				} else if state != "absent" {
					selected(object, candidate.role)["securityContext"].(map[string]any)["allowPrivilegeEscalation"] = state == "true"
				}
				want := object.DeepCopy()
				if state == "no-security-context" {
					selected(want, candidate.role)["securityContext"] = map[string]any{}
				}
				selected(want, candidate.role)["securityContext"].(map[string]any)["allowPrivilegeEscalation"] = false
				changed := mutate(t, system, object, admissionv1.Create, types.SourceTypeOriginal)
				if changed != (state != "false") {
					t.Fatalf("unexpected changed=%t for %s", changed, state)
				}
				assertObject(t, object, want)
				if mutate(t, system, object, admissionv1.Create, types.SourceTypeOriginal) {
					t.Fatal("second mutation must be idempotent")
				}
				assertObject(t, object, want)
			})
		}
	}
}

func TestUnselectedPodsUnchanged(t *testing.T) {
	cohorts := loadCohorts(t)
	system := newSystem(t, cohorts, nil)
	for _, candidate := range cohorts {
		controls := []struct {
			name      string
			operation admissionv1.Operation
			source    types.SourceType
			edit      func(*unstructured.Unstructured)
		}{
			{"UPDATE", admissionv1.Update, types.SourceTypeOriginal, nil},
			{"DELETE", admissionv1.Delete, types.SourceTypeOriginal, nil},
			{"CONNECT", admissionv1.Connect, types.SourceTypeOriginal, nil},
			{"missing-operation", "", types.SourceTypeOriginal, nil},
			{"generated", admissionv1.Create, types.SourceTypeGenerated, nil},
			{"wrong-namespace", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) { object.SetNamespace("ccd") }},
			{"missing-label", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) { object.SetLabels(nil) }},
			{"wrong-label", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) {
				object.SetLabels(map[string]string{"hmcts.net/mutation-pilot": "other"})
			}},
			{"unrelated-image", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) {
				selected(object, candidate.role)["image"] = "unapproved.invalid/other:1"
			}},
			{"absent-selected-container", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) {
				object.Object["spec"].(map[string]any)[candidate.role] = []any{}
			}},
			{"wrong-role", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) {
				other := "initContainers"
				if candidate.role == other {
					other = "containers"
				}
				container := selected(object, candidate.role)
				object.Object["spec"].(map[string]any)[candidate.role] = []any{}
				object.Object["spec"].(map[string]any)[other] = []any{container}
			}},
			{"ephemeral-only", admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) {
				container := selected(object, candidate.role)
				object.Object["spec"].(map[string]any)[candidate.role] = []any{}
				object.Object["spec"].(map[string]any)["ephemeralContainers"] = []any{container}
			}},
		}
		for _, image := range []string{
			"hmctsprod.azurecr.io/imported/dynatrace/dynatrace-operator:1.0",
			"public.ecr.aws/dynatrace/dynatrace-operator:1.0",
			"yrk32651.live.dynatrace.com/linux/oneagent:1.0",
			"ebe20728.live.dynatrace.com/linux/oneagent:1.0",
		} {
			controls = append(controls, struct {
				name      string
				operation admissionv1.Operation
				source    types.SourceType
				edit      func(*unstructured.Unstructured)
			}{"approved-vendor-image/" + image, admissionv1.Create, types.SourceTypeOriginal, func(object *unstructured.Unstructured) {
				selected(object, candidate.role)["image"] = image
			}})
		}
		for _, control := range controls {
			t.Run(candidate.name+"/"+control.name, func(t *testing.T) {
				object := fixture(candidate)
				if control.edit != nil {
					control.edit(object)
				}
				want := object.DeepCopy()
				if mutate(t, system, object, control.operation, control.source) {
					t.Fatal("unselected Pod was mutated")
				}
				assertObject(t, object, want)
			})
		}
	}
}

func TestNamespaceExclusionsWithOverlappingPositiveMatch(t *testing.T) {
	cohorts := loadCohorts(t)
	for _, namespace := range []string{"kube-system", "gatekeeper-system", "azure-arc", "azure-extensions-usage-system", "monitoring"} {
		t.Run(namespace, func(t *testing.T) {
			for _, clear := range []bool{false, true} {
				system := newSystem(t, cohorts, func(object map[string]any) {
					match := object["spec"].(map[string]any)["match"].(map[string]any)
					match["namespaces"] = []any{namespace}
					if clear {
						match["excludedNamespaces"] = []any{}
					}
				})
				object := fixture(cohorts[0])
				object.SetNamespace(namespace)
				want := object.DeepCopy()
				if mutate(t, system, object, admissionv1.Create, types.SourceTypeOriginal) != clear {
					t.Fatal("namespace exclusion did not independently protect an overlapping candidate")
				}
				if !clear {
					assertObject(t, object, want)
				}
			}
		})
	}
}

func TestMixedPodChangesOnlyReviewedContainers(t *testing.T) {
	cohorts := loadCohorts(t)
	system := newSystem(t, cohorts, nil)
	object := fixture(cohorts[0])
	spec := object.Object["spec"].(map[string]any)
	spec["containers"], spec["initContainers"] = []any{}, []any{}
	for _, candidate := range cohorts {
		container := selected(fixture(candidate), candidate.role)
		container["name"] = strings.ToLower(candidate.name)
		spec[candidate.role] = append(spec[candidate.role].([]any), container)
	}
	spec["initContainers"] = append(spec["initContainers"].([]any), map[string]any{
		"name": "configure-sysctl", "image": "hmctsprod.azurecr.io/imported/elastic/elasticsearch:9.2.3",
		"securityContext": map[string]any{"privileged": true, "runAsUser": int64(0)},
	})
	spec["containers"] = append(spec["containers"].([]any), map[string]any{
		"name": "unrelated-curl", "image": "hmctsprod.azurecr.io/curl:7.70.0",
	})
	spec["ephemeralContainers"] = []any{map[string]any{
		"name": "debug", "image": "hmctsprod.azurecr.io/imported/elastic/elasticsearch:9.2.3",
	}}
	want := object.DeepCopy()
	for _, role := range []string{"containers", "initContainers"} {
		for _, entry := range want.Object["spec"].(map[string]any)[role].([]any) {
			container := entry.(map[string]any)
			if strings.HasPrefix(container["name"].(string), "hmctsnoprivescpilot") {
				container["securityContext"].(map[string]any)["allowPrivilegeEscalation"] = false
			}
		}
	}
	if !mutate(t, system, object, admissionv1.Create, types.SourceTypeOriginal) {
		t.Fatal("mixed Pod should mutate")
	}
	assertObject(t, object, want)
	if mutate(t, system, object, admissionv1.Create, types.SourceTypeOriginal) {
		t.Fatal("mixed Pod should be idempotent")
	}
	assertObject(t, object, want)
}

func TestConflictingListKeyIsDetected(t *testing.T) {
	cohorts := loadCohorts(t)
	system := newSystem(t, cohorts, nil)
	var object map[string]any
	if err := json.Unmarshal(cohorts[0].definition, &object); err != nil {
		t.Fatal(err)
	}
	object["metadata"].(map[string]any)["name"] = "conflicting-name-key"
	spec := object["spec"].(map[string]any)
	spec["location"] = "spec.containers[name:reviewed-container].securityContext.allowPrivilegeEscalation"
	spec["parameters"].(map[string]any)["pathTests"] = []any{map[string]any{
		"subPath": "spec.containers[name:reviewed-container]", "condition": "MustExist",
	}}
	content, err := json.Marshal(object)
	if err != nil {
		t.Fatal(err)
	}
	var resource mutations.Assign
	if err := json.Unmarshal(content, &resource); err != nil {
		t.Fatal(err)
	}
	mutator, err := assign.MutatorForAssign(&resource)
	if err != nil {
		t.Fatal(err)
	}
	if err := system.Upsert(mutator); err == nil {
		t.Fatal("conflicting list key was not detected")
	}
}

func TestKnownUnsafeSelectionsRemainActivationBlockers(t *testing.T) {
	cohorts := loadCohorts(t)
	system := newSystem(t, cohorts, nil)
	regular, init := cohorts[0], cohorts[0]
	for _, candidate := range cohorts {
		if candidate.role == "initContainers" {
			init = candidate
		} else {
			regular = candidate
		}
	}
	controls := []struct {
		name      string
		candidate cohort
		edit      func(*unstructured.Unstructured)
	}{
		{"windows-node-selector", regular, func(object *unstructured.Unstructured) {
			object.Object["spec"].(map[string]any)["nodeSelector"] = map[string]any{"kubernetes.io/os": "windows"}
		}},
		{"windows-pod-os", regular, func(object *unstructured.Unstructured) {
			object.Object["spec"].(map[string]any)["os"] = map[string]any{"name": "windows"}
		}},
		{"privileged", regular, func(object *unstructured.Unstructured) {
			selected(object, regular.role)["securityContext"].(map[string]any)["privileged"] = true
		}},
		{"SYS_ADMIN", regular, func(object *unstructured.Unstructured) {
			selected(object, regular.role)["securityContext"].(map[string]any)["capabilities"] = map[string]any{"add": []any{"SYS_ADMIN"}}
		}},
		{"different-name-same-curl-image", init, func(object *unstructured.Unstructured) { selected(object, init.role)["name"] = "unreviewed-helper" }},
	}
	for _, control := range controls {
		t.Run(control.name, func(t *testing.T) {
			object := fixture(control.candidate)
			control.edit(object)
			if !mutate(t, system, object, admissionv1.Create, types.SourceTypeOriginal) {
				t.Fatal("known selection behavior changed, reassess the documented activation blocker")
			}
			if selected(object, control.candidate.role)["securityContext"].(map[string]any)["allowPrivilegeEscalation"] != false {
				t.Fatal("expected unsafe selection was not reproduced")
			}
			t.Log("REPRODUCED ACTIVATION BLOCKER, not a safety acceptance result")
		})
	}
}
