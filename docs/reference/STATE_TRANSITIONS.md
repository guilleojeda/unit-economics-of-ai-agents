# State Transitions Reference

## Document

```text
UPLOADED → INSPECTING: allowed
INSPECTING → READY: allowed
INSPECTING → UNSUPPORTED: allowed
INSPECTING → FAILED_INSPECTION: allowed
READY → INSPECTING: allowed only for reinspection
UNSUPPORTED → job creation: disallowed
FAILED_INSPECTION → job creation: disallowed
```

## TranslationJob

```text
CREATED → RUNNING: allowed
RUNNING → AWAITING_REVIEW: allowed
RUNNING → FAILED: allowed
AWAITING_REVIEW → ACCEPTED: allowed
AWAITING_REVIEW → REJECTED: allowed
AWAITING_REVIEW → ESCALATED: allowed
REJECTED → RUNNING: allowed only as remediation attempt if product later supports it
ACCEPTED → RUNNING: disallowed
```

## Run

```text
CREATED → QUEUED: allowed
QUEUED → RUNNING: allowed
RUNNING → EVALUATING: allowed
EVALUATING → AWAITING_REVIEW: allowed
RUNNING/EVALUATING → FAILED: allowed
AWAITING_REVIEW → ACCEPTED: allowed
AWAITING_REVIEW → REJECTED: allowed
AWAITING_REVIEW → ESCALATED: allowed
FAILED → any non-terminal state: disallowed
ACCEPTED/REJECTED/ESCALATED → any other state: disallowed
```

Invalid transitions return HTTP 409.
