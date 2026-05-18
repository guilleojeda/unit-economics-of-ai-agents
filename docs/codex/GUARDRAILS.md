# Codex Guardrails

```text
1. Do not invent AWS prices.
2. Do not hard-code model IDs.
3. Do not hard-code price-book values into UI or business logic.
4. Do not store PDF bytes in DynamoDB.
5. Do not pass raw PDFs through AgentCore requests.
6. Do not treat automated evaluation as acceptance.
7. Do not treat review as free.
8. Do not make failed/rejected attempts disappear from economics.
9. Do not implement arbitrary scanned-PDF support in MVP.
10. Do not introduce product modes for recording.
11. Do not use logs as the sole source of cost truth.
12. Do not let tools mutate Run or Job state directly; the agent/control API persists state.
13. Do not let V2/V3 work block V1.
14. Do not add AgentCore Memory unless a concrete glossary/reviewer-preference memory behavior is implemented.
15. Do not claim AWS-bill reconciliation unless it is actually implemented.
```
