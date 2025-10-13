# AKS Policy Review - Recommendations

**Date:** 12 October 2025  
**Reviewer:** Platform Operations Team  
**Data Source:** Ticket compliance reports (September 2025)  
**Policies Reviewed:** 33 AKS security policies (Parts 1-4)

---

## 📊 Executive Summary

**Current Status:**
- ✅ **2 policies already enforced** (Deny mode)
- ✅ **6 policies ready to enforce** (100% compliant)
- ⚠️ **5 policies need minor fixes** (2-10 resources affected)
- 🔴 **5 policies need major remediation** (67+ namespaces affected)
- ❌ **4 policies should NOT be enforced** (configuration issues)
- ❓ **9 policies status unclear** (Part 4 - need verification)
- 📋 **2 policies not in scope** (existing pre-deployment)

**Recommended Actions:**
1. **This week:** Enforce 6 compliant policies (no team impact)
2. **Weeks 2-4:** Remediate minor issues, then enforce 5 policies
3. **Months 2-3:** Major team remediation campaign for 5 critical policies
4. **Keep in Audit:** 4 policies indefinitely

---

## 📋 Policy Categorization Table

### ✅ Category A: ENFORCE NOW (6 policies)

**Criteria:** 100% compliant, zero team impact, ready for Deny mode

| # | Policy Name | Compliance | Non-Compliant Resources | Recommendation | Timeline |
|---|-------------|------------|-------------------------|----------------|----------|
| 1 | **FlexVolume Drivers** | ✅ 100% | 0 | Move to Deny | This week |
| 2 | **ProcMount Types** | ✅ 100% | 0 | Move to Deny | This week |
| 3 | **No Forbidden Sysctls** | ✅ 100% | 0 | Move to Deny | This week |
| 4 | **Allowed AppArmor Profiles** | ✅ 100% | 0 | Move to Deny | This week |
| 5 | **Required Annotations** | ✅ 100% | 0 (none enforced) | Move to Deny | This week |
| 6 | **Readiness/Liveness Probes** | ✅ ~98% | Only temp pods | Clean up temp pods, then Deny | Week 2 |

**Action Required:**
- Update assignment files: Change `"effect": "Audit"` to `"effect": "Deny"`
- Test in sandbox first (optional, already 100% compliant)
- Deploy to HMCTS MG via pipeline
- **Estimated effort:** 2-3 hours total
- **Team communication:** None needed

---

### ⚠️ Category B: REMEDIATE THEN ENFORCE (5 policies)

**Criteria:** 80-95% compliant, affects 2-10 resources, fixable in 2-4 weeks

| # | Policy Name | Compliance | Non-Compliant Resources | Teams Affected | Timeline |
|---|-------------|------------|-------------------------|----------------|----------|
| 7 | **HostPath Volumes** | ~75% | 21/28 clusters | civil namespace only | 2 weeks |
| 8 | **SELinux Options** | ~46% | 15/28 clusters | dynatrace namespace | 2 weeks |
| 9 | **User/Group IDs** | ~4% | 27/28 clusters | 7 namespaces (ccd, civil, cnp, chart-tests, default, mi, testkube) | 3 weeks |
| 10 | **Allowed Capabilities** | ~95% | Container: nmi | Platform team (aad-pod-identity) | 2 weeks |
| 11 | **No Latest Image Tag** | ~99% | 2 temp apps | Temp deployments in sandbox | 1 week |

**Action Required for Each:**
1. **Identify specific non-compliant resources** (az policy state list)
2. **Contact owning teams** via email/Slack with:
   - Which resources are non-compliant
   - How to fix (provide YAML examples)
   - Deadline (2-4 weeks)
   - Support channel
3. **Track remediation weekly**
4. **Move to Deny** after ≥95% compliance
5. **Estimated effort:** 10-15 hours (includes drafting guides, tracking, follow-ups)

**Communication Template Needed:** Yes (see Section 4)

---

### 🔴 Category C: MAJOR TEAM REMEDIATION (5 policies)

**Criteria:** <80% compliant, affects many teams, requires 60-90 days

| # | Policy Name | Compliance | Non-Compliant Resources | Impact | Timeline |
|---|-------------|------------|-------------------------|--------|----------|
| 12 | **Seccomp Profiles** ⚠️ | ~15% | 28/28 clusters, **67 namespaces** | **CRITICAL** - All teams | 60 days |
| 13 | **Read-Only Root FS** ⚠️ | ~15% | 28/28 clusters, **67 namespaces** | **CRITICAL** - All teams | 90 days |
| 14 | **Container Resource Limits** | ~30% | KPS, cert-manager, cnp-crumble, npd | Core platform apps | 30 days |
| 15 | **Allowed Pull Policy** | ~65% | 28/28 clusters, 10 namespaces | am, ccd, civil, cnp, fees-pay, mi, pcq, rd, cronjob | 45 days |
| 16 | **No Privileged Containers** | ~70% | Monitoring/admin namespaces | dynatrace, neuvector | 30 days (or exempt) |

**Affected Namespaces (67 total):**
aac, adoption, am, ambassador, appreg, bsp, ccd, chart-tests, civil, cnp, courtfines, cpo, cronjob, cui, darts-modernisation, default, dg, disposer, divorce, dm-store, docmosis, dtsse, em, enforcement, et, et-pet, ethos, fact, family-public-law, fees-pay, financial-remedy, fis, help-with-fees, hmc, ia, idam, ingress-nginx, jd, juror, labs, lau, mailrelay, mailrelay2, met, mi, money-claims, nfdiv, opal, pcq, pcs, pdda, pip, pre, private-law, probate, rd, reform-scan, response, rpe, slack-help-bot, sptribs, sscs, tax-tribunals, testkube, toffee, ts, wa, xui

**Action Required:**
1. **Draft organization-wide communication** (all teams)
2. **Create detailed how-to guides** with:
   - YAML examples for each policy
   - Testing instructions
   - Common issues/FAQ
3. **Set staggered deadlines:**
   - High priority (Resource Limits, Privileged): 30 days
   - Medium priority (Pull Policy): 45 days
   - Low priority (Seccomp, Root FS): 60-90 days
4. **Schedule weekly office hours** for team support
5. **Track compliance improvements** weekly
6. **Phased enforcement:**
   - Month 1: Sandbox only in Deny
   - Month 2: Non-prod in Deny
   - Month 3: Prod in Deny (after ≥95% compliance)

**Estimated effort:** 100+ hours (guides, communications, support, tracking)

**Communication Template Needed:** Yes - organization-wide (see Section 4)

---

### ❌ Category D: KEEP AUDIT ONLY (4 policies)

**Criteria:** Policy configuration issues, no enforcement possible

| # | Policy Name | Status | Reason NOT to Enforce | Action |
|---|-------------|--------|----------------------|--------|
| 17 | **PreStop Hook** | DISABLED | Multiple system + HMCTS apps don't have hooks; not critical security control | Keep in Audit, educate teams on best practices |
| 18 | **Pod Specified Labels** | Non-Compliant | No common labels exist across all pods | Keep in Audit, review quarterly |
| 19 | **Service Allowed Ports** | Non-Compliant | Allow list too extensive (elasticsearch, logstash, postgres, monitoring) | Update allow list, then reconsider |
| 20 | **Host Network & Ports** | Non-Compliant | Ops namespaces require host network access | Exempt admin/monitoring, reconsider for teams |

**Action Required:**
1. **Document WHY** each policy is not enforced
2. **Review quarterly** to see if situation changes
3. **Use as educational/advisory** for teams
4. **Update allow lists** where needed, then reconsider enforcement

**Estimated effort:** 2-3 hours (documentation only)

---

### ❓ Category E: PART 4 - STATUS UNCLEAR (9 policies)

**Note:** These policies were mentioned in Part 4 ticket but compliance status not documented.

| # | Policy Name | Expected Status | Action Needed |
|---|-------------|----------------|---------------|
| 21 | Windows Container Resource Limits | Likely compliant (no Windows nodes) | Verify compliance |
| 22 | Windows No ContainerAdmin | Likely compliant (no Windows nodes) | Verify compliance |
| 23 | Windows User/Group IDs | Likely compliant (no Windows nodes) | Verify compliance |
| 24 | Windows No HostProcess | Likely compliant (no Windows nodes) | Verify compliance |
| 25 | HTTPS Only | Unknown | Check compliance |
| 26 | No Privilege Escalation | Unknown | Check compliance |
| 27 | No CAP_SYS_ADMIN | Unknown | Check compliance |
| 28 | No Specific Security Capabilities | Unknown | Check compliance |
| 29 | Use CSI Driver StorageClass | Unknown | Check compliance |

**Action Required:**
- Run compliance check for these 9 policies
- Categorize into A/B/C/D based on results
- Add to enforcement plan

**Estimated effort:** 2-3 hours (compliance check + categorization)

---

### 📋 Category F: ALREADY ENFORCED (2 policies)

**Status:** Already in Deny mode, no action needed

| # | Policy Name | Status | Compliance | Notes |
|---|-------------|--------|------------|-------|
| 30 | **Allowed External IPs** | ✅ Deny | 100% | Successfully enforced |
| 31 | **No Naked Pods** | ✅ Deny | 100% | Successfully enforced |

**Action Required:** None - continue monitoring

---

## 🎯 Recommended Timeline

### **Week 1 (This Week)**
**Goal:** Quick wins - enforce compliant policies

- [ ] Update 6 policy assignments (Category A) to Deny mode
- [ ] Test in sandbox (optional)
- [ ] Deploy via pipeline
- [ ] Verify enforcement working
- [ ] **Deliverable:** 6 more policies in Deny mode

**Estimated effort:** 4 hours

---

### **Weeks 2-4 (Month 1)**
**Goal:** Minor remediations

- [ ] Draft communication for Category B policies
- [ ] Create how-to guides for each policy
- [ ] Contact affected teams (5 policies, ~15 teams total)
- [ ] Track remediation weekly
- [ ] Move to Deny after ≥95% compliance
- [ ] **Deliverable:** 5 more policies in Deny mode

**Estimated effort:** 15 hours

---

### **Months 2-3**
**Goal:** Major team remediation

- [ ] Week 5: Draft organization-wide communication
- [ ] Week 6: Create detailed how-to guides for 5 critical policies
- [ ] Week 7: Launch communication campaign (email + Slack + meetings)
- [ ] Week 8-12: Weekly office hours, track compliance improvements
- [ ] Month 3: Phased enforcement (sandbox → non-prod → prod)
- [ ] **Deliverable:** 5 critical policies enforced

**Estimated effort:** 100+ hours (spread across team)

---

### **Month 4+**
**Goal:** Review and adjust

- [ ] Verify Part 4 policies (9 policies)
- [ ] Review Category D policies quarterly
- [ ] Monitor security incidents
- [ ] Adjust based on feedback
- [ ] Update allow lists where needed

**Estimated effort:** 5 hours/quarter

---

## 📧 Section 4: Communication Templates

### **Template 1: Minor Fixes (Category B)**

**Subject:** Action Required: AKS Policy Compliance - [Policy Name]

```
Hi [Team],

We've deployed AKS security policies to improve cluster security. Your namespace 
has [X] non-compliant resources that need attention.

📋 WHAT'S AFFECTED:
Policy: [Policy Name]
Your Resources: [List of pod/resource names]
Namespace: [namespace name]

🔧 HOW TO FIX:
[Specific YAML changes needed - see attached guide]

Example:
spec:
  securityContext:
    [specific security setting]

📅 DEADLINE: [Date - 2-4 weeks from now]

📚 RESOURCES:
- How-to guide: [Link]
- Support: #platform-operations on Slack
- Questions: Reply to this email

⚠️ WHAT HAPPENS NEXT:
After the deadline, this policy will be enforced (Deny mode). 
New deployments that don't meet the policy will be blocked.
Existing resources are not affected.

Need help? We're here to support you!
```

---

### **Template 2: Major Remediation (Category C)**

**Subject:** IMPORTANT: AKS Security Policy Rollout - Action Required by [Date]

```
Hi Everyone,

As part of our security hardening initiative, we're enforcing AKS security policies 
across all clusters. Some policies require changes to your pod specifications.

🎯 POLICIES REQUIRING ACTION:

1. Seccomp Profiles (60-day deadline)
   - All pods must specify seccomp profile
   - Impact: ALL namespaces
   - Effort: Low (2 lines of YAML)

2. Read-Only Root Filesystem (90-day deadline)
   - Containers must use read-only root filesystem
   - Impact: ALL namespaces
   - Effort: Medium (may require testing)

3. Container Resource Limits (30-day deadline)
   - All containers must have CPU/memory limits
   - Impact: ~20% of applications
   - Effort: Low-Medium

[Full list and guides: Confluence link]

📅 TIMELINE:
- Now - Month 1: Review and test changes
- Month 1: Deploy to sandbox (Deny mode enabled)
- Month 2: Deploy to non-prod (Deny mode enabled)
- Month 3: Deploy to prod (after ≥95% compliance)

🆘 SUPPORT:
- How-to guides: [Confluence link]
- Office Hours: Every Tuesday 2-3pm (starting [date])
- Slack: #aks-policy-help
- Email: platform-operations@hmcts.net

📊 CHECK YOUR COMPLIANCE:
Run this command to see your non-compliant resources:
[CLI command]

Or check Azure Portal: [Link with filter]

❓ FAQS:
Q: What if I can't meet the deadline?
A: Request an exemption: [exemption process link]

Q: Will this break my existing deployments?
A: No, only NEW deployments will be blocked after enforcement.

Q: I need help with testing
A: Join our office hours or ping us on Slack

We're here to help! Let's work together to improve our security posture.

Thanks,
Platform Operations Team
```

---

## 📊 Section 5: Success Metrics

Track these KPIs to measure progress:

| Metric | Current | Target (Month 1) | Target (Month 3) |
|--------|---------|------------------|------------------|
| **Policies in Deny mode** | 2 | 13 (2+6+5) | 18 (2+6+5+5) |
| **Overall compliance rate** | ~60% | ~85% | ~95% |
| **Teams acknowledged** | N/A | 80% | 100% |
| **Resources remediated** | N/A | Category B complete | Categories B+C complete |
| **Exemptions granted** | 0 | <5 | <10 |

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Teams can't meet deadlines** | Medium | Medium | Extend deadlines, provide more support, allow exemptions |
| **Enforcement blocks prod deployments** | High | Low | Phased rollout (sandbox → non-prod → prod), emergency exemption process |
| **Third-party tools incompatible** | Medium | Medium | Namespace exemptions, vendor engagement |
| **Team capacity overload** | Medium | High | Stagger deadlines, provide scripts/automation |

---

## ✅ Recommendations Summary

**I recommend the following approach:**

1. **✅ APPROVE: Enforce 6 compliant policies now** (Week 1)
   - Zero team impact
   - Already 100% compliant
   - Low risk

2. **⚠️ APPROVE: Minor remediation campaign** (Weeks 2-4)
   - Contact ~15 teams
   - 2-4 week deadlines
   - Manageable effort

3. **🔴 APPROVE WITH CONDITIONS: Major remediation** (Months 2-3)
   - Organization-wide impact
   - Requires significant resources (100+ hours)
   - Need executive buy-in
   - Phased rollout essential

4. **❌ APPROVE: Keep 4 policies in Audit only**
   - Not suitable for enforcement
   - Review quarterly

5. **❓ VERIFY: Check Part 4 policies first**
   - Need compliance data before categorization

---

## 🤔 Questions for Team Discussion

1. **Do you agree with this categorization?**
2. **Can we enforce the 6 compliant policies this week?**
3. **What's our capacity for the major remediation campaign?**
4. **Who will create the how-to guides?**
5. **Should we verify Part 4 policies before proceeding?**
6. **What's the exemption process for teams that can't comply?**
7. **Do we have executive support for organization-wide communications?**

---

## 📞 Next Steps

1. **Schedule team meeting** to review these recommendations
2. **Get approval** for timeline and approach
3. **After approval:**
   - Week 1: Update 6 assignments to Deny
   - Weeks 2-4: Draft communications for Category B
   - Month 2: Launch Category C campaign

---

**Document Owner:** Platform Operations Team  
**Last Updated:** 12 October 2025  
**Status:** Ready for team review and approval

---

**Appendices:**
- Appendix A: Full policy list (41 policies) - see `AKS_POLICY_ACTUAL_COUNT.md`
- Appendix B: Ticket compliance data - see attached tickets
- Appendix C: How-to guides - TBD (to be created after approval)
