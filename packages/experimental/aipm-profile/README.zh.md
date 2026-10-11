---
description: "AIPM 工作台 profile 组合包 — 把 AIPM 领域插件插入已加载 dsh-base 的 profile。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-aipm-profile

[English](README.md) | 中文

## 概述

可选 Cordis 组合包，把 AIPM 工作台领域插件（`@deepseek-ai/dsh-experimental-aipm`）、内置 `project-initiation-report` Skill，以及 Web 工作台面板加到任何已加载 `dsh-base` 的 profile。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

---

<a id="use-this-package"></a>
## 使用本包

通过 `cordis.patch.yml` overlay，把本组合包叠在已加载 base 的 profile 上：

```yaml
# ~/.dsh/cordis.patch.yml  (or via --patch flag)
- insert:
    - id: aipm-profile
      name: '@deepseek-ai/dsh-experimental-aipm-profile'
```

或在自定义 profile 的 bundle 列表中直接引用。

`dsh-base` 提供 `dsh-skill`（`dsh-experimental-aipm` 依赖它），因此叠在任何 base profile 上时不需要额外前置条件。

挂载后，模型可通过 `ctx.skills` 使用 `project-initiation-report` Skill。Web 侧边栏会出现 **工作台**。`initAIPMProject` 等领域 API 仍可在没有 Web UI 的情况下从 TypeScript 调用。

---

<a id="understand-the-implementation"></a>
## 理解实现

本组合包的运行时内容是 `cordis.patch.yml`，它插入一行 Cordis 配置：

```yaml
- insert:
    - id: aipm
      name: '@deepseek-ai/dsh-experimental-aipm'

    - id: ui-aipm
      name: '@deepseek-ai/dsh-experimental-client-ui-aipm'
```

dsh 安装会把本组合包放进插件页，默认关闭。一次启动可用 `--patch` overlay 打开。

---

<a id="model-experience"></a>
## 模型体验

间接地，通过本组合包插入的 AIPM 插件：skill 注册表按需加载 project-initiation-report。

#### KV Cache 影响

本组合包不增加常驻提示词。Skill 内容是稳定的磁盘数据，只有调用方加载该 Skill 时才会插入。

## 已知限制与延期工作

- **默认关闭** — 可从插件页、profile 组合包列表或 `--patch` 启用。
