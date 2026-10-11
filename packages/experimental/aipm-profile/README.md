---
description: "AIPM workbench profile bundle — inserts the AIPM domain plugin into a base-backed profile."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-aipm-profile

English | [中文](README.zh.md)

## Summary

Optional Cordis bundle that adds the AIPM workbench domain plugin (`@deepseek-ai/dsh-experimental-aipm`), its bundled `project-initiation-report` skill, and the Web workbench panel to any profile already loaded with `dsh-base`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

---

<a id="use-this-package"></a>
## Use this package

Apply this bundle on top of a base-backed profile via a `cordis.patch.yml` overlay:

```yaml
# ~/.dsh/cordis.patch.yml  (or via --patch flag)
- insert:
    - id: aipm-profile
      name: '@deepseek-ai/dsh-experimental-aipm-profile'
```

Or reference it directly in a custom profile's bundle list.

`dsh-base` provides `dsh-skill` (required by `dsh-experimental-aipm`), so no additional prerequisite is needed when layering on top of any base-backed profile.

After mounting, the model has access to the `project-initiation-report` skill through `ctx.skills`. The Web sidebar shows **Workbench**. Domain APIs such as `initAIPMProject` remain callable from TypeScript without the Web UI.

---

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle's runtime content is `cordis.patch.yml`, which inserts a single Cordis row:

```yaml
- insert:
    - id: aipm
      name: '@deepseek-ai/dsh-experimental-aipm'

    - id: ui-aipm
      name: '@deepseek-ai/dsh-experimental-client-ui-aipm'
```

The dsh installation ships this bundle switched off on the Plugins page. A `--patch` overlay turns it on for one launch.

---

<a id="model-experience"></a>
## Model Experience

Indirectly, through the AIPM plugin the bundle inserts: the skill registry loads project-initiation-report on demand.

#### KV Cache effect

The bundle adds no standing prompt text. Skill content is stable disk data inserted only when a caller loads the skill.

## Known Limitations and Deferred Work

- **Switched off by default** — enable it from the Plugins page, a profile bundle list, or `--patch`.
