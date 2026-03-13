# Architecture Improvement Issues

These issues address 8 architectural weaknesses identified in the Pravik Builder codebase. They should be tackled in order of criticality, with dependencies respected.

## Execution Order

| # | Issue | Criticality | Impact | Effort | Dependencies |
|---|-------|-------------|--------|--------|--------------|
| 1 | [Tool Registry Pattern](./001-tool-registry-pattern.md) | Critical | Every new tool is error-prone | Medium (1-2 days) | None |
| 2 | [Shared Event Contract](./002-shared-event-contract.md) | Critical | Silent bugs as events grow | Small (half day) | None |
| 3 | [Layered Prompt System](./003-layered-prompt-system.md) | Critical | AI accuracy degrades with more tools | Medium (1 day) | Partial dep on #1 |
| 4 | [State Reconciliation](./004-state-reconciliation.md) | High | State drift during calls | Small (half day) | None |
| 5 | [ToolContext Decomposition](./005-toolcontext-decomposition.md) | High | Hard to reason about mutations | Medium (1 day) | Best after #1 |
| 6 | [Modular Pipeline](./006-modular-pipeline.md) | Medium | Hard to extend/test | Medium (1 day) | Best after #1 |
| 7 | [Circuit Breaker](./007-circuit-breaker.md) | Medium | Bad UX during outages | Small (few hours) | None |
| 8 | [Preview Push Over Poll](./008-preview-push-over-poll.md) | Medium | Server load at scale | Small (remove after #4) | **Requires #4** |

## Dependency Graph

```
#1 Tool Registry ─────┬──> #3 Layered Prompts
                       ├──> #5 ToolContext Decomposition
                       └──> #6 Modular Pipeline

#2 Shared Event Contract (independent)

#4 State Reconciliation ──> #8 Preview Push Over Poll

#7 Circuit Breaker (independent)
```

## Recommended Attack Order

**Wave 1 — Independent, high-impact** (can be done in parallel):
- Issue #2: Shared Event Contract (half day, prevents new bugs)
- Issue #7: Circuit Breaker (few hours, prevents bad UX)
- Issue #4: State Reconciliation (half day, fixes state drift)

**Wave 2 — Foundation** (sequential):
- Issue #1: Tool Registry Pattern (1-2 days, enables #3, #5, #6)

**Wave 3 — Built on registry** (can be done in parallel):
- Issue #3: Layered Prompt System (1 day)
- Issue #5: ToolContext Decomposition (1 day)

**Wave 4 — Polish**:
- Issue #6: Modular Pipeline (1 day)
- Issue #8: Preview Push Over Poll (trivial after #4)

## Test Summary

Each issue includes specific test cases. Total new tests across all issues:

| Issue | Unit Tests | Integration Tests | Total |
|-------|-----------|-------------------|-------|
| #1 Tool Registry | 11 | 4 | 15 |
| #2 Event Contract | 6 (TS) + 5 (Py) | 2 (cross-lang) | 13 |
| #3 Layered Prompts | 12 | 3 | 15 |
| #4 State Reconciliation | 8 (API) + 6 (hook) | — | 14 |
| #5 ToolContext Decomposition | 3 + 7 + 4 | 3 | 17 |
| #6 Modular Pipeline | 3 + 4 + 7 | — | 14 |
| #7 Circuit Breaker | 8 + 7 | 3 | 18 |
| #8 Preview Push Over Poll | 5 + 2 | — | 7 |
| **Total** | | | **~113** |

Combined with the existing 123 regression tests, the target test suite will have **~236 tests**.
