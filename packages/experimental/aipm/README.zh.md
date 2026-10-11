---
description: "AIPM 工作台领域模型、本地项目初始化，以及随包提供的 PM Skill。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-aipm

[English](README.md) | 中文

## 概述

AIPM（AI Product Manager）工作台的非 UI 领域层，面向 DeepSeek Harness。提供八阶段产品经理流水线模型、本地项目初始化、资料导入、本地 Skill 安装、立项闸门、待审文件替换、Git 快照，以及内置的 `project-initiation-report` Skill。

## 目录

- [使用本包](#use-this-package)
- [领域模型](#domain-model)
- [本地项目初始化](#local-project-initialization)
- [资料、Skill、闸门与审阅](#assets-skills-gates-and-review)
- [内置 Skill](#bundled-skills)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

---

<a id="use-this-package"></a>
## 使用本包

在同时包含 `@deepseek-ai/dsh-skill` 的 Cordis 组合中挂载本插件。插件从包内 `skills/` 目录读取内置 Skill，并注册到 `ctx.skills`。当存在 `ctx.connection` 和 `ctx.workspaceRegistry` 时，还会为 Web 工作台提供 `/api/aipm.state` 和 `/api/aipm.command`。

```yaml
- name: '@deepseek-ai/dsh-skill'
- name: '@deepseek-ai/dsh-experimental-aipm'
```

只需要领域模型时，不必挂载插件，直接使用导出的工具函数：

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
## 领域模型

### 八个固定流水线阶段

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

阶段 ID 与目录名写入磁盘后必须保持稳定，项目初始化后不得更改。

### 七种生命周期状态

`not-started` · `insufficient-data` · `in-progress` · `pending-review` · `approved` · `needs-rework` · `skipped`

---

<a id="local-project-initialization"></a>
## 本地项目初始化

`initAIPMProject(options)` 会创建目录树、`assets/`、`.dsh/skills/`、`.aipm/pending/` 和 `aipm.json`。若已存在清单则抛错。已存在的目录记入 `existingDirs` 且保持不变。

`readAIPMManifest(rootDir)` 读取并校验清单。`updateAIPMStage(rootDir, stageId, patch)` 写入某一阶段的状态或备注。

---

<a id="assets-skills-gates-and-review"></a>
## 资料、Skill、闸门与审阅

`importAIPMAsset` 复制本地文件，或把网页 / 飞书 / 图片来源连同源信息写入 `assets/`。

`installAIPMSkill` 安装内置 Skill 或本地 `SKILL.md` 目录。项目作用域复制到 `.dsh/skills/`；全局作用域复制到 `$DSH_HOME/skills` 或 `~/.dsh/skills`。`recommendAIPMSkillStages` 根据 Skill 名称和描述建议阶段 ID；`confirmAIPMSkillStages` 保存用户确认后的绑定。Git URL 安装会抛出未实现错误，直到该安装器落地。

`confirmAIPMInitiationGate` 按顺序执行四个立项闸门（`problem` → `evidence` → `mvp` → `decision`）。

`proposeAIPMFileChange` 把替换方案记入 `.aipm/pending/`，并不写入目标文件。`applyAIPMFileChange` / `rejectAIPMFileChange` 接受或丢弃该记录。`createAIPMSnapshot` 在产物获批或过闸后创建 Git 提交，或报告工作区干净。

---

<a id="bundled-skills"></a>
## 内置 Skill

挂载插件时注册一个运行时 Skill：

| Skill name | Invocable by |
|---|---|
| `project-initiation-report` | model, user |

Skill 正文在激活时从 `skills/project-initiation-report/SKILL.md` 读取。其 `resourceBase` 指向同一目录，因此模型可以解析相对文件（`methodology.md`、`quality-checklist.md`、`report-template.md`、`html-template.md`）。

---

<a id="model-experience"></a>
## 模型体验

间接地，通过 skill 注册表：内置 project-initiation-report 正文按需加载。

#### KV Cache 影响

技能正文是稳定的磁盘内容。只有调用方把它插入模型请求时才会追加请求 token。

## 已知限制与延期工作

- **Git Skill 安装** — `sourceKind: 'git'` 已类型化，但会以未实现错误拒绝。
- **权限执行** — Skill 权限标志会被记录；首次工具授权仍走现有 approval 栈。
- **远程抓取** — 网页、飞书和图片种类记录元数据及可选正文，本身不发起网络请求。
- **团队与 SaaS** — 账号、云同步、多租户隔离、计费和实时共编不在范围内。
