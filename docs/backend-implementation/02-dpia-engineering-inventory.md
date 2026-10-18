# Slice 0 — engineering inventory for DPIA review

Date: 2026-10-18. **Draft inventory for the accountable privacy/legal owner. This
is not a completed DPIA, lawful-basis determination, risk self-assessment, or
approval to process real children's data.** Production startup is disabled.

The implemented environment uses synthetic `.invalid` identities only. Public
guests receive no server identity and retain their learning data on their device.
The identity bootstrap stores a pseudonymous learner ID, synthetic identity,
grade, self-declared age band, timezone, encrypted guardian address, and consent
workflow records. Birth year is discarded after deriving the age band; client
learning answers and FlowContext are not retained by identity endpoints.

| Proposed processing | Purpose and implemented boundary | Approval still required |
|---|---|---|
| Identity bootstrap | Local synthetic email simulator; opaque hash-only session tokens; no real provider | Verified identity/guardian relationship, age assurance, minimum age, notices and provider agreement |
| Pending onboarding | Grade and derived age band; nickname/subject preferences refused pending consent | Minimum necessary bootstrap fields and approved collection language |
| Consent | Separate purpose decisions, exact immutable synthetic text hash, actor and database timestamp | Actual consent texts, policy archive/version-change procedure, guardian verification strength |
| Learning, AI, intake, analytics | No learning endpoints; all feature flags off; no external AI calls | Separate per-slice privacy and technical gates; no inference of permission from a simulated grant |
| Logs/traces | Route template, generated request ID, method, status and timing; canary tested | Exporter vendor, location, access controls, retention and incident response |
| Deletion | Immediate processing stop/session revocation; PostgreSQL deletion jobs; complete Slice 0 row removal; digest receipt | Approved retention, notification delivery, restricted receipt store, key lifecycle and actual backup restore drill |

Engineering defaults for review: pending bootstrap/link expiry seven days,
sign-in link fifteen minutes, session idle seven days/absolute thirty days,
idempotency seven days, and synthetic grants thirty days. Receipt metadata uses
the specification's proposed thirty-five-day backup horizon; this local setup
has **no managed backup system**. These values are provisional development
choices, not legal conclusions or approved production retention schedules.

Review must assign the DPIA/risk-assessment owner and DPO responsibility; confirm
the current authoritative legal sources mentioned in architecture 08; document
the intended student ages and guardian assurance; evaluate child-friendly
notices, supervision and complaints; assess profiling before Slice 1; approve
providers, processor terms, geography, transfers and subcontractors; define
access/export/correction/deletion verification; and approve incident notification
and staff access procedures. The implementation does not settle any of these.

The current main risks are false reliance on synthetic identity/consent, use of
unreviewed policy text, data collection before valid consent, disclosure through
logs, broken guardian linkage, key loss/rotation and resurrection after restore.
Engineering controls reduce specific risks in the synthetic environment. A
privacy owner must assess likelihood, impact, residual risk and acceptance for
the intended real deployment before any deployment is enabled.
