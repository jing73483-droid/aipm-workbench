# AIPM 工作台

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）定制的 AI 产品经理桌面工作台。本仓库是个人公开镜像与定制层，**不是 DeepSeek 官方仓库**。

## 里面有什么

- 桌面端 Electron 入口：`AIPM工作台.app`（源码安装脚本，不是网页版）
- AIPM 八阶段流水线：需求洞察 → 市场/用户研究 → BRD → 立项 → PRD → 设计交接 → 开发测试交接 → 上线复盘
- 内置 PM Skill：`mrd-writing`、`brd-writing`、`competitive-analysis`、`project-initiation-report`、`prd-writing`、`design-spec`、`prompt-optimizer-ai-pm`、`pm-doc-writer`

## 本机运行（macOS）

需要 Node.js 22.19+ 或 24+。

```sh
git clone https://github.com/jing73483-droid/aipm-workbench.git
cd aipm-workbench
pnpm install
pnpm run build
pnpm run install:aipm-desktop
```

安装完成后，桌面上会出现 **AIPM工作台**。第一次会准备 desktop profile 和 primary runtime，之后直接点图标打开。

只跑源码、不装桌面图标：

```sh
pnpm run start:desktop
```

## 模型

工作台是 BYOK：在 **设置 → 模型** 里添加已对你开放的 API（DeepSeek / Kimi / 智谱等）。官方 Claude / OpenAI API 对中国大陆用户不开放，不要填官网地址。

密钥存在本机 `~/.dsh/.credentials.yaml`，不要提交到 Git。

## 使用 Skill

对话里输入 `/` 再选 Skill 名称，例如 `/competitive-analysis`。`/目标` 是工作台自带的目标命令，不是 Skill。

## 许可证

上游 DeepSeek Harness 为 MIT，版权归 DeepSeek。本仓库在其上增加的 AIPM 定制同样按 MIT 分发。第三方依赖见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
