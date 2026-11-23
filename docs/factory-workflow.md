# Hearth Software Factory — Ticket-to-Main Workflow

This diagram documents Hearth's end-to-end delivery pipeline from GitHub Issue creation to merging into `main`, including verification gates, retry limits, and human decision points.

```mermaid
flowchart TD
    A["1. GitHub Issue Created"] --> B{"Label: ready-for-agent?"}
    B -- Yes --> C["GitHub Actions: ready-for-agent.yml<br/>Creates agent/issue-N branch & runs baseline checks"]
    B -- No --> D["Manual Agent Assignment"]
    C --> E["2. Pre-Work Investigation<br/>Read issue acceptance criteria, AGENTS.md,<br/>& Codebase Wisdom (when Qodo CLI active)"]
    D --> E
    E --> F["3. Implement Change on Feature Branch"]
    F --> G["4. Local Verification Gate<br/>npm test && npm run build<br/>+ Qodo Local Review (uncommitted changes)"]
    G -- "Fails / High or Medium finding" --> H{"Retry count < 2?"}
    H -- Yes --> F
    H -- No (stalled) --> X["STOP: Escalate to Human Maintainer<br/>Report task as NOT DONE"]
    G -- "Passes (0 High/Medium)" --> I["5. Commit, Push & Open PR<br/>Include Issue URL & Acceptance Criteria"]
    I --> J["6. CI & PR Review<br/>CI Build & Tests + Qodo PR Review<br/>+ Arnica Security Scan [Planned]"]
    J --> K{"Qodo PR Findings /<br/>Review Resolver?"}
    K -- "Valid High or Medium" --> L{"Fix loop < 2?"}
    L -- Yes --> F
    L -- No (stalled) --> X
    K -- "Disagreed" --> M["Human Reviews Disagreement Evidence"]
    M -- "Rejected by human" --> F
    M -- "Accepted" --> N
    K -- "0 High/Medium<br/>(Low flagged only)" --> N["7. Quality Gate Passed<br/>CI green + Latest head reviewed<br/>+ Low findings listed for maintainer"]
    N --> O["8. Human Maintainer Approval & Merge to main"]
```

## Gate Summary

| Stage | Check | Blocking Criteria | On Failure / Escalation |
| :--- | :--- | :--- | :--- |
| **Trigger (`ready-for-agent`)** | Baseline `npm test && npm run build` (max 2 attempts) | Non-zero exit code | Stops workflow and comments on issue |
| **Pre-Commit** | `npm test && npm run build` + Qodo local review | Any test/build error or valid High/Medium finding | Fix locally; escalate if stalled after 2 retries |
| **Pull Request** | CI (`node 22`) + Qodo PR review on latest head | Failing CI, stale review, or unresolved High/Medium finding | Fix via Review Resolver loop or escalate with evidence |
| **Merge to `main`** | Human maintainer approval | Unreviewed head, Low findings unreported, or protected path | Maintainer decides whether to merge or request changes |
