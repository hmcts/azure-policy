# AKS Policy Compliance Report - Final Review
**Generated:** 13 October 2025  
**Ticket:** DTSPO-27741 - Review AKS Policy Rollout (Parts 1-4)  
**Data Source:** Azure Portal ComplianceListExport.csv (13 October 2025)  
**Scope:** HMCTS Management Group (28-30 AKS clusters)

---

## Recommended Actions

✅ **Ready to Enforce: 11 policies** (Compliant with 0 non-compliant resources)
- No Forbidden Sysctls
- FlexVolume Drivers
- ProcMount Types
- SELinux Options
- Allowed External IPs
- No Naked Pods
- Required Annotations
- Windows No HostProcess
- HTTPS Only
- No Specific Security Capabilities
- Use CSI Driver StorageClass

🔴 **Remediation Required: 20 policies** (Non-compliant AKS clusters)
- Liveness/Readiness Probes
- No Latest Image Tag
- Container Resource Limits
- No Host PID/IPC
- Allowed AppArmor Profiles
- Allowed Capabilities
- Allowed Pull Policy
- Allowed Seccomp Profiles
- HostPath Volumes
- Read-Only Root FS
- Allowed User/Group IDs
- Allowed Volume Types
- No Host Network/Ports
- Allowed Service Ports
- No Privileged Containers
- Windows No HostPath (3 Windows-specific policies)
- No Privilege Escalation
- No CAP_SYS_ADMIN

❌ **Keep Audit Only:** 2 policies (Not suitable for enforcement)
- PreStop Hook (Policy disabled)
- Pod Labels (No common labels defined)

**Total:** 33 policies reviewed

---

## Executive Summary

This report reviews the 33 AKS security policies deployed in Parts 1-4 based on actual compliance data from Azure Portal.

**Related Tickets:**
- DTSPO-27228: Test policies that may impact teams - Part 1 (8 policies)
- DTSPO-27229: Test policies that may impact teams - Part 2 (8 policies)
- DTSPO-27230: Test policies that may impact teams - Part 3 (8 policies)
- DTSPO-27231: Test policies that may impact teams - Part 4 (9 policies)

**Data Source:** Azure Portal Compliance Export (ComplianceListExport.csv)  
**Recommendations:** Based on Azure's compliance classification

---


## Part 1: Security Recommendations (8 policies)

| # | Policy Name | Compliance State | Resource Compliance | Non-Compliant | Recommendation |
|---|-------------|------------------|---------------------|---------------|----------------|
| 1 | 🔴 Liveness/Readiness Probes | Non-compliant | 3% (1 out of 29) | 27 | Remediation Required |
| 2 | ❌ PreStop Hook | Compliant | 100% (0 out of 0) | 0 | Keep Audit (Policy disabled) |
| 3 | 🔴 No Latest Image Tag | Non-compliant | 14% (4 out of 29) | 24 | Remediation Required |
| 4 | 🔴 Container Resource Limits | Non-compliant | 0% (0 out of 29) | 28 | Remediation Required |
| 5 | 🔴 No Host PID/IPC | Non-compliant | 38% (11 out of 29) | 17 | Remediation Required |
| 6 | ✅ No Forbidden Sysctls | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 7 | 🔴 Allowed AppArmor Profiles | Non-compliant | 41% (12 out of 29) | 16 | Remediation Required |
| 8 | 🔴 Allowed Capabilities | Non-compliant | 34% (10 out of 29) | 18 | Remediation Required |


## Part 2: Container Security (8 policies)

| # | Policy Name | Compliance State | Resource Compliance | Non-Compliant | Recommendation |
|---|-------------|------------------|---------------------|---------------|----------------|
| 1 | 🔴 Allowed Pull Policy | Non-compliant | 24% (7 out of 29) | 21 | Remediation Required |
| 2 | 🔴 Allowed Seccomp Profiles | Non-compliant | 3% (1 out of 29) | 27 | Remediation Required |
| 3 | ✅ FlexVolume Drivers | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 4 | 🔴 HostPath Volumes | Non-compliant | 93% (27 out of 29) | 1 | Remediation Required |
| 5 | ✅ ProcMount Types | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 6 | 🔴 Read-Only Root FS | Non-compliant | 3% (1 out of 29) | 27 | Remediation Required |
| 7 | ✅ SELinux Options | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 8 | 🔴 User/Group IDs | Non-compliant | 48% (14 out of 29) | 14 | Remediation Required |


## Part 3: Pod Security (8 policies)

| # | Policy Name | Compliance State | Resource Compliance | Non-Compliant | Recommendation |
|---|-------------|------------------|---------------------|---------------|----------------|
| 1 | 🔴 Allowed Volume Types | Non-compliant | 24% (7 out of 29) | 21 | Remediation Required |
| 2 | 🔴 Host Network & Ports | Non-compliant | 38% (11 out of 29) | 17 | Remediation Required |
| 3 | ❌ Pod Specified Labels | Non-compliant | 0% (0 out of 29) | 28 | Keep Audit (No common labels) |
| 4 | 🔴 Service Allowed Ports | Non-compliant | 7% (2 out of 29) | 26 | Remediation Required |
| 5 | ✅ Allowed External IPs | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 6 | 🔴 No Privileged Containers | Non-compliant | 34% (10 out of 29) | 18 | Remediation Required |
| 7 | ✅ No Naked Pods | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 8 | ✅ Required Annotations | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |


## Part 4: Advanced Security (9 policies)

| # | Policy Name | Compliance State | Resource Compliance | Non-Compliant | Recommendation |
|---|-------------|------------------|---------------------|---------------|----------------|
| 1 | 🔴 Windows Resource Limits | Non-compliant | 69% (20 out of 29) | 8 | Remediation Required |
| 2 | 🔴 Windows No ContainerAdmin | Non-compliant | 69% (20 out of 29) | 8 | Remediation Required |
| 3 | 🔴 Windows User/Group IDs | Non-compliant | 69% (20 out of 29) | 8 | Remediation Required |
| 4 | ✅ Windows No HostProcess | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 5 | ✅ HTTPS Only | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 6 | 🔴 No Privilege Escalation | Non-compliant | 17% (5 out of 29) | 23 | Remediation Required |
| 7 | 🔴 No CAP_SYS_ADMIN | Non-compliant | 38% (11 out of 29) | 17 | Remediation Required |
| 8 | ✅ No Specific Security Capabilities | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |
| 9 | ✅ Use CSI Driver StorageClass | Compliant | 97% (28 out of 29) | 0 | Ready to Enforce |

---

## Discussion Points & Decisions Needed

### 1. Immediate Enforcement Decision
**Question:** Should we enforce the 11 compliant policies now?
- ✅ **Recommendation:** YES - These have 0 non-compliant resources and are ready
- **Impact:** No disruption to teams (already compliant)
- **Action if approved:** Change enforcement mode from Audit to Deny

### 2. Remediation Approach for 20 Non-Compliant Policies
**Question:** What is our approach and timeline for the 20 non-compliant policies?

**Options to discuss:**
- **Option A - Phased Approach:** Group by severity/complexity, tackle in phases (3-6 months)
- **Option B - Big Bang:** Set single deadline for all policies (e.g., 90 days)
- **Option C - Priority-Based:** Enforce critical security policies first, others later

**Decisions needed:**
- Which approach do we take?
- What are the deadlines?
- Who owns creating remediation guides?
- How do we track progress?

### 3. Team Communication Plan
**Question:** How do we communicate this to development teams?

**Decisions needed:**
- When do we announce the enforcement plan?
- What communication channels? (Email, Slack, Wiki, All-hands?)
- Who is the point of contact for questions?
- Do we need training sessions or office hours?

**Draft communication should include:**
- List of policies being enforced
- Deadlines for remediation
- How to check compliance for their clusters
- Remediation guides/documentation links
- Support contacts

### 4. Monitoring & Compliance Tracking
**Question:** How do we track remediation progress?

**Decisions needed:**
- Weekly/monthly compliance reports?
- Dashboard for teams to self-serve?
- Escalation process for teams missing deadlines?
- Exception/waiver process for valid cases?

### 5. The 2 "Keep Audit" Policies
**Question:** What do we do with PreStop Hook and Pod Labels policies?

**Options:**
- Keep in Audit mode indefinitely
- Disable these policies entirely
- Revisit quarterly to see if circumstances change

