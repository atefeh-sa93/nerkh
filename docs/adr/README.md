# Architecture decision records

Each ADR records one decision: the problem, what we chose, what we rejected and what it costs. ADRs are not edited after they are accepted; a later ADR supersedes an earlier one.

| #                                 | Decision                                             | Status        |
| --------------------------------- | ---------------------------------------------------- | ------------- |
| [001](001-monorepo.md)            | One Turborepo + pnpm monorepo for all apps           | Accepted      |
| [002](002-batching-and-worker.md) | Batch updates per animation frame, parse in a Worker | Accepted      |
| 003                               | Store Iranian prices in rial, show toman             | Planned (#25) |
| 004                               | Stream and periodic data are shown differently       | Planned (#28) |
| 005                               | Three run modes: mock, snapshot, live                | Planned (#3)  |

## Template

```md
# NNN. Title

- Status: Proposed | Accepted | Superseded by NNN
- Date: YYYY-MM-DD

## Context

What problem or force makes a decision necessary.

## Decision

What we do.

## Alternatives considered

What else was possible and why it lost.

## Consequences

What gets easier, what gets harder, and what we must keep doing.
```
