---
description: "Web AIPM workbench: project tree, create form, and split Markdown review."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-aipm

English | [中文](README.zh.md)

## Summary

Adds an AIPM workbench panel to Web: a project tree, a form-then-chat create flow, split Markdown editing, and pending-change approval. Host JSON lives on `/api/aipm.state` and `/api/aipm.command`. Enable it through `@deepseek-ai/dsh-experimental-aipm-profile`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

---

<a id="use-this-package"></a>
## Use this package

Enable this package through [`@deepseek-ai/dsh-experimental-aipm-profile`](../aipm-profile/README.md). The Web Client loader mounts the `/client` export; the root Host export is inert.

The sidebar **Workbench** entry opens the panel. Create a project in a registered workspace, then continue in chat. File edits can be submitted for split-pane review before they write.

---

<a id="understand-the-implementation"></a>
## Understand the implementation

The browser plugin registers `sidebar.brand.name`, a `sidebar.panellist` entry, and a keyed `main` panel. It reads Host state over `fetch`. Domain mutations stay in `@deepseek-ai/dsh-experimental-aipm`.

---

<a id="model-experience"></a>
## Model Experience

The panel registers no model-facing input. Chat after create uses the ordinary conversation.

#### KV Cache effect

None from this package.

## Known Limitations and Deferred Work

- **Remote fetch** — webpage and 飞书 assets record metadata; they do not download remotely here.
- **Git skill install** — still rejected by the Host domain layer.
