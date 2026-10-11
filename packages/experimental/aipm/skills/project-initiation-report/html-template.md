# HTML 决策页模板

## 生成规则

- 仅在 Markdown 立项报告被用户明确确认后生成。
- 内容结论、数字、范围、风险和来源必须与已确认 Markdown 一致。
- 输出为单文件 `立项报告.html`，CSS 与必要脚本内嵌；默认不依赖 CDN。
- 使用语义化 HTML，支持桌面阅读、移动端和打印。
- 首页必须在一屏内回答：做不做、为什么、先做什么、投什么、何时停。
- 图表只使用真实数据。无基线时展示“待建立基线”，不要画虚假比例。
- 每个关键数字附近标注 `事实 / 测算 / 推断 / 假设 / 未知` 和来源编号。
- 正文保持决策密度；详细来源、计算和方法放入可折叠附录。
- 不复用任何案例的品牌、业务内容、数字或视觉资产。

## 推荐信息架构

1. 固定侧边导航与阅读进度；
2. Hero：项目名、结论、版本、日期、Owner；
3. 一页纸决策摘要；
4. 问题、用户与证据；
5. 机会与差异化；
6. 目标与指标；
7. MVP 范围与明确不做；
8. AI 专项（适用时）；
9. 资源、阶段计划与关键路径；
10. 风险、闸门、停止条件；
11. 待决策与数据缺口；
12. 来源和计算附录。

## 单文件骨架

将占位符替换为已确认内容，并按项目实际增删卡片。不要保留空章节。

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>[项目名称] · 立项报告</title>
  <style>
    :root {
      --bg: #f4f1e9;
      --paper: #fffdf7;
      --ink: #17201d;
      --muted: #66706c;
      --line: rgba(23,32,29,.12);
      --primary: #2457e6;
      --accent: #c8ef52;
      --good: #07866f;
      --warn: #d66a1f;
      --danger: #c33d3d;
      --radius: 18px;
      --shadow: 0 18px 50px rgba(23,32,29,.08);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(rgba(23,32,29,.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(23,32,29,.025) 1px, transparent 1px),
        var(--bg);
      background-size: 24px 24px;
      font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.7;
    }
    .progress { position: fixed; inset: 0 0 auto 260px; height: 4px; z-index: 20; }
    .progress > i { display: block; width: 0; height: 100%; background: var(--primary); }
    aside {
      position: fixed; inset: 0 auto 0 0; width: 260px; padding: 32px 22px;
      color: white; background: var(--ink); overflow: auto;
    }
    .brand { font-size: 21px; font-weight: 900; margin-bottom: 28px; }
    .brand b { color: var(--accent); }
    nav a {
      display: block; margin: 4px 0; padding: 9px 12px; border-radius: 9px;
      color: rgba(255,255,255,.64); text-decoration: none; font-size: 13px;
    }
    nav a:hover, nav a.active { color: var(--accent); background: rgba(200,239,82,.1); }
    main { max-width: 1180px; margin-left: 260px; padding: 52px 56px 100px; }
    section { margin: 0 0 70px; scroll-margin-top: 24px; }
    .hero { padding: 14px 0 22px; }
    .eyebrow { color: var(--primary); font-size: 12px; font-weight: 800; letter-spacing: .16em; }
    h1 { max-width: 900px; margin: 12px 0 16px; font-size: clamp(34px,5vw,58px); line-height: 1.08; letter-spacing: -.04em; }
    h2 { margin: 0 0 22px; font-size: 31px; letter-spacing: -.025em; }
    h3 { margin: 28px 0 12px; font-size: 18px; }
    .meta, .grid { display: grid; gap: 16px; }
    .meta { grid-template-columns: repeat(4, minmax(0,1fr)); margin-top: 22px; }
    .grid.two { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .grid.three { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .card {
      padding: 24px; border: 1px solid var(--line); border-radius: var(--radius);
      background: var(--paper); box-shadow: var(--shadow);
    }
    .decision {
      padding: 30px; color: white; border-left: 6px solid var(--accent);
      border-radius: var(--radius); background: var(--ink);
    }
    .decision strong { color: var(--accent); }
    .kicker { color: var(--muted); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .value { margin-top: 6px; font-size: 25px; font-weight: 900; line-height: 1.25; }
    .tag {
      display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 800; background: rgba(36,87,230,.1); color: var(--primary);
    }
    .tag.fact { color: var(--good); background: rgba(7,134,111,.1); }
    .tag.estimate { color: var(--warn); background: rgba(214,106,31,.1); }
    .tag.unknown { color: var(--danger); background: rgba(195,61,61,.1); }
    .scope-do { border-top: 5px solid var(--good); }
    .scope-dont { border-top: 5px solid var(--danger); }
    table { width: 100%; border-collapse: collapse; background: var(--paper); border-radius: 14px; overflow: hidden; }
    th { color: white; background: var(--ink); text-align: left; font-size: 12px; }
    th, td { padding: 13px 15px; border-bottom: 1px solid var(--line); vertical-align: top; }
    .gate { display: grid; grid-template-columns: 90px 1fr 150px; gap: 16px; align-items: start; padding: 18px 0; border-top: 1px solid var(--line); }
    .gate b { color: var(--primary); }
    .risk { padding: 16px 18px; border-left: 4px solid var(--danger); border-radius: 10px; background: rgba(195,61,61,.06); }
    details { margin: 10px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
    summary { cursor: pointer; padding: 15px 18px; font-weight: 800; }
    details > div { padding: 0 18px 18px; }
    .source { color: var(--muted); font-size: 12px; }
    @media (max-width: 900px) {
      aside { display: none; }
      .progress { left: 0; }
      main { margin: 0; padding: 34px 20px 70px; }
      .meta, .grid.two, .grid.three { grid-template-columns: 1fr; }
      .gate { grid-template-columns: 1fr; }
    }
    @media print {
      aside, .progress { display: none; }
      main { max-width: none; margin: 0; padding: 0; }
      section { break-inside: avoid; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="progress"><i id="progressBar"></i></div>
  <aside>
    <div class="brand">[项目简称]<b>.</b></div>
    <nav>
      <a href="#summary">00 决策摘要</a>
      <a href="#evidence">01 问题与证据</a>
      <a href="#opportunity">02 机会与差异化</a>
      <a href="#scope">03 第一阶段范围</a>
      <a href="#plan">04 投入与计划</a>
      <a href="#risks">05 风险与止损</a>
      <a href="#appendix">06 附录</a>
    </nav>
  </aside>

  <main>
    <header class="hero">
      <div class="eyebrow">PROJECT INITIATION · [版本]</div>
      <h1>[项目名称]立项报告</h1>
      <p>[一句话说明本报告要解决的决策。]</p>
      <div class="meta">
        <div><div class="kicker">建议</div><div class="value">[结论]</div></div>
        <div><div class="kicker">首期周期</div><div class="value">[周期]</div></div>
        <div><div class="kicker">资源</div><div class="value">[核心投入]</div></div>
        <div><div class="kicker">决策日</div><div class="value">[日期]</div></div>
      </div>
    </header>

    <section id="summary">
      <h2>一页纸决策摘要</h2>
      <div class="decision">
        <div class="kicker">建议结论</div>
        <p><strong>[立项 / 条件立项 / 转向验证 / 停止]</strong></p>
        <p>[最强证据、最大不确定性、第一阶段投入和停止条件。]</p>
      </div>
      <div class="grid three" style="margin-top:16px">
        <article class="card"><div class="kicker">为什么现在</div><p>[机会窗口/不行动代价]</p></article>
        <article class="card"><div class="kicker">先做什么</div><p>[最小闭环]</p></article>
        <article class="card"><div class="kicker">何时停止</div><p>[停止条件]</p></article>
      </div>
    </section>

    <section id="evidence">
      <h2>问题、用户与证据</h2>
      <article class="card">
        <div class="kicker">问题定义</div>
        <p>[不含预设功能的一句话问题定义]</p>
      </article>
      <!-- 只展示有来源的关键事实；将局限和反证放在同一区域。 -->
    </section>

    <section id="opportunity">
      <h2>机会与差异化</h2>
      <!-- 展示四类替代、关键比较、差异化句式和最强反方论证。 -->
    </section>

    <section id="scope">
      <h2>第一阶段范围</h2>
      <div class="grid two">
        <article class="card scope-do"><h3>必须做</h3><ul><li>[范围项与依据]</li></ul></article>
        <article class="card scope-dont"><h3>明确不做</h3><ul><li>[范围项、原因与重启条件]</li></ul></article>
      </div>
      <!-- AI 项目在此后加入独立的 AI 专项卡片。 -->
    </section>

    <section id="plan">
      <h2>投入、闸门与路线图</h2>
      <div class="gate"><b>[阶段 A]</b><span>[验证内容与产出]</span><span>[通过门槛]</span></div>
      <div class="gate"><b>[阶段 B]</b><span>[验证内容与产出]</span><span>[通过门槛]</span></div>
    </section>

    <section id="risks">
      <h2>风险、待决策与停止条件</h2>
      <div class="risk"><b>[最高风险]</b><br>[触发信号、兜底、Owner]</div>
      <!-- 分别呈现待决策事项、数据缺口和明确停止条件。 -->
    </section>

    <section id="appendix">
      <h2>来源与计算</h2>
      <details><summary>来源索引</summary><div>[来源、链接/文件、日期、样本、口径]</div></details>
      <details><summary>关键测算</summary><div>[公式、假设、敏感性区间]</div></details>
    </section>
  </main>

  <script>
    const links = [...document.querySelectorAll("nav a")];
    const sections = [...document.querySelectorAll("main section")];
    function update() {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      document.querySelector("#progressBar").style.width = `${max ? root.scrollTop / max * 100 : 0}%`;
      let current = sections[0]?.id;
      sections.forEach(section => {
        if (section.getBoundingClientRect().top <= 150) current = section.id;
      });
      links.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${current}`));
    }
    addEventListener("scroll", update, { passive: true });
    update();
  </script>
</body>
</html>
```

## 可视化选择

仅在能提高决策理解时使用：

- 漏斗：定位最大流失与对应专题；
- 用户旅程：对比现状、目标状态和衡量方式；
- 竞品矩阵：展示关键差异，不罗列全部功能；
- MVP 双栏：必须做与明确不做；
- 阶段闸门：每阶段验证什么、不过如何处理；
- 资源热力图：显示瓶颈与可并行团队；
- 风险矩阵：仅用于已有判断依据的风险。

不要使用无数据的饼图、装饰性增长曲线或暗示虚假精度的仪表盘。
