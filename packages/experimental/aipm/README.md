---
description: "AIPM workbench domain model, local project initialization, and bundled PM skills for the DeepSeek Harness."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-aipm

English | [中文](README.zh.md)

## Summary

AIPM (AI Product Manager) workbench non-UI domain layer for the DeepSeek Harness. Provides the eight-stage PM pipeline model, local project initialization, asset import, local skill installation, initiation gates, pending file review, Git snapshots, and a bundled `project-initiation-report` skill.

## Table of Contents

- [Use this package](#use-this-package)
- [Domain model](#domain-model)
- [Local project initialization](#local-project-initialization)
- [Assets, skills, gates, and review](#assets-skills-gates-and-review)
- [Bundled skills](#bundled-skills)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

---

<a id="use-this-package"></a>
## Use this package

Mount the plugin in a Cordis composition that also includes `@deepseek-ai/dsh-skill`. The plugin reads the bundled skill from its package-local `skills/` directory and registers it on `ctx.skills`. When `ctx.connection` and `ctx.workspaceRegistry` are present, it also serves `/api/aipm.state` and `/api/aipm.command` for the Web workbench.

```yaml
- name: '@deepseek-ai/dsh-skill'
- name: '@deepseek-ai/dsh-experimental-aipm'
```

Use the exported utilities directly without mounting the plugin when only the domain model is needed:

```ts
import { initAIPMProject, importAIPMAsset } from '@deepseek-ai/dsh-experimental-aipm'

const result = await initAIPMProject({
  name: 'My Feature',
  type: 'feature',
  objective: 'Improve onboarding conversion by 15%',
  rootDir: '/absolute/path/to/project',
})
```

---

<a id="domain-model"></a>
## Domain model

### Eight fixed pipeline stages

| Order | ID | Directory | Name |
|---|---|---|---|
| 1 | `requirement-insight` | `01-requirement-insight` | 需求洞察 |
| 2 | `market-user-research` | `02-market-user-research` | 市场/用户研究 |
| 3 | `brd` | `03-brd` | BRD |
| 4 | `project-initiation` | `04-project-initiation` | 立项 |
| 5 | `prd` | `05-prd` | PRD |
| 6 | `design-handoff` | `06-design-handoff` | 设计交接 |
| 7 | `dev-test-handoff` | `07-dev-test-handoff` | 开发/测试交接 |
| 8 | `launch-retrospective` | `08-launch-retrospective` | 上线复盘 |

Stage IDs and directory names are stable on disk and must not change after projects have been initialized.

### Seven lifecycle statuses

`not-started` · `insufficient-data` · `in-progress` · `pending-review` · `approved` · `needs-rework` · `skipped`

---

<a id="local-project-initialization"></a>
## Local project initialization

`initAIPMProject(options)` creates the directory tree, `assets/`, `.dsh/skills/`, `.aipm/pending/`, and `aipm.json`. A pre-existing manifest causes the call to throw. Existing directories are recorded in `existingDirs` and left unchanged.

`readAIPMManifest(rootDir)` reads and validates a manifest. `updateAIPMStage(rootDir, stageId, patch)` writes status or notes for one stage.

---

<a id="assets-skills-gates-and-review"></a>
## Assets, skills, gates, and review

`importAIPMAsset` copies a local file, or records a webpage / 飞书 / image source into `assets/` with origin metadata.

`installAIPMSkill` installs a builtin skill or a local `SKILL.md` directory. Project scope copies into `.dsh/skills/`; global scope copies into `$DSH_HOME/skills` or `~/.dsh/skills`. `recommendAIPMSkillStages` suggests stage IDs from the skill name and description; `confirmAIPMSkillStages` stores the user-confirmed binding. Git URL installation throws until that installer ships.

`confirmAIPMInitiationGate` enforces the four initiation gates in order (`problem` → `evidence` → `mvp` → `decision`).

`proposeAIPMFileChange` records a replacement under `.aipm/pending/` without writing the target file. `applyAIPMFileChange` / `rejectAIPMFileChange` accept or discard that record. `createAIPMSnapshot` creates a Git commit after an approved artifact or gate, or reports a clean tree.

---

<a id="bundled-skills"></a>
## Bundled skills

The plugin registers one runtime skill when mounted:

| Skill name | Invocable by |
|---|---|
| `project-initiation-report` | model, user |

The skill body is read from `skills/project-initiation-report/SKILL.md` at activation time. Its `resourceBase` points to the same directory so the model can resolve relative files (`methodology.md`, `quality-checklist.md`, `report-template.md`, `html-template.md`).

---

<a id="model-experience"></a>
## Model Experience

Indirectly, through the skill registry: the bundled project-initiation-report body is loaded on demand.

#### KV Cache effect

The skill body is stable disk content. Loading it appends request tokens only when a caller inserts the skill into a model request.

## Known Limitations and Deferred Work

- **Git skill install** — `sourceKind: 'git'` is typed and rejected with a not-implemented error.
- **Permission enforcement** — skill permission flags are recorded; first-use tool authorization stays on the existing approval stack.
- **Remote fetch** — webpage, 飞书, and image kinds record metadata and optional captured bodies; they do not fetch the network themselves.
- **Teams and SaaS** — accounts, cloud sync, multi-tenant isolation, billing, and real-time co-editing are out of scope.
