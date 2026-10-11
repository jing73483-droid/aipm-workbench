---
description: "Web AIPM 工作台：项目树、创建表单与分栏 Markdown 审阅。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-aipm

[English](README.md) | 中文

## 概述

为 Web 增加 AIPM 工作台面板：项目树、先表单后对话的创建流程、分栏 Markdown 编辑，以及待审阅改动的通过/驳回。Host JSON 走 `/api/aipm.state` 与 `/api/aipm.command`。通过 `@deepseek-ai/dsh-experimental-aipm-profile` 启用。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

---

<a id="use-this-package"></a>
## 使用本包

通过 [`@deepseek-ai/dsh-experimental-aipm-profile`](../aipm-profile/README.zh.md) 启用。Web Client loader 挂载 `/client` 导出；根 Host 导出是空操作。

侧边栏的 **工作台** 入口打开该面板。在已登记工作区里创建项目，然后去对话里继续。文件编辑可以先提交分栏审阅，再写入磁盘。

---

<a id="understand-the-implementation"></a>
## 理解实现

浏览器插件注册 `sidebar.brand.name`、`sidebar.panellist` 入口和 keyed `main` 面板。状态通过 `fetch` 读取。领域变更仍在 `@deepseek-ai/dsh-experimental-aipm`。

---

<a id="model-experience"></a>
## 模型体验

本面板不注册面向模型的输入。创建后的对话使用普通会话。

#### KV Cache 影响

本包无影响。

## 已知限制与延期工作

- **远程抓取** — 网页和飞书资料只记录元数据，不在此下载。
- **Git Skill 安装** — 仍由 Host 领域层拒绝。
