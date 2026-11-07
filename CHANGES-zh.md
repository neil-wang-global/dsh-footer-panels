# 改动明细（CHANGES-zh.md）

本文档说明：为了把 **POMASA Studio** 和 **Pictor** 两个插件的入口**置顶到侧边栏「全局面板」列表**，本次改动涉及哪些仓库、改了哪些文件、以及**哪些东西没有被改**。

撰写时间：2026-11-07
参与者：Neil

---

## 0. 一句话总结

**两个第三方插件的源码一行未改。** 全部改动集中在一个新增的小插件 `dsh-footer-panels`，以及 DSH profile 的三行配置。

| 载体 | 类型 | 改动量 |
| --- | --- | --- |
| `dsh-footer-panels` | **新增**开源仓库 | 9 个文件，729 行 |
| `~/.dsh/profiles/web/package.json` | **修改** DSH 配置 | +1 依赖，+1 bundle |
| `pomasa-studio` | 第三方插件 | **0 改动** |
| `dsh-pictor` | 第三方插件 | **0 改动** |
| `dsh-claude-style` | 第三方插件 | **0 改动** |

---

## 1. 起因：为什么需要这个改动

### 1.1 原始状态

POMASA Studio 和 Pictor 都采用同一个界面模式：

- 工作台界面渲染在 DSH 的 `shell.overlay` 图层（有界浮层，覆盖中栏）；
- 入口是注册在 `sidebar.footer.action` 插槽里的一个**侧边栏底部按钮**。

即：**功能都装在底部栏那个小位置里**。

### 1.2 三个问题

1. **挤** —— 底部区域还要容纳设置、意见反馈、退出登录等系统项，插件越多越窄；
2. **低** —— 位于侧边栏最不显眼的位置，高频功能每次要往下找；
3. **脆** —— 任何对底部区域做二次加工的皮肤插件都可能破坏它。

### 1.3 实际踩到的故障

安装 `dsh-claude-style` 后，两个插件**彻底无法从界面打开**。

根因（已实测复现）：

1. claude-style 执行「页脚接管」（footer takeover）：遍历 `sidebar.footer.action` 的每个条目，**深拷贝一份**塞进账号弹层，同时用 CSS 隐藏**原始按钮**；
2. 它给克隆体挂点击转发时，需要把镜像节点**逐层映射回源节点**；
3. POMASA / Pictor 的底部组件，可点击元素是**嵌套在内部**的，不是条目根节点 —— 层级映射失败，转发返回 `null`，点击被 `stopPropagation()` 吞掉。

结果：账号弹层里能看到「POMASA Studio」「Pictor」两行，**点了没反应**，而原按钮又已被隐藏。

> 补充背景：排查时发现 `dsh-claude-style` 当时**并不在** profile 的 `dsh.profile.bundles` 列表里（只在 `dependencies` 中），即处于「装了但未加载」状态。这解释了为什么会出现「主题时好时坏」的现象。

---

## 2. 方案选择：为什么是「新增插件 + 配置」，而不是「改插件」

评估过 5 个方案：

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A. 走其他入口 | 用自带入口打开，不依赖底部按钮 | 治标，体验差 |
| **B. 提升为全局面板** | **注册真正的面板入口** | **✅ 采用** |
| C. 关闭 claude-style 页脚接管 | 改皮肤配置 | 牺牲皮肤功能 |
| D. 给 claude-style 提 issue | 等上游修 | 周期不可控 |
| E. 改 POMASA 注册插槽 | 改第三方源码 | 违反原则 |

**采用方案 B**，并确立三条原则：

1. **不修改任何第三方插件源码**（便于升级、便于管理）；
2. **通过 DSH 公开插槽与服务实现**，不依赖私有 API；
3. **配置驱动** —— 面板清单是数据，POMASA 和 Pictor 只是两个示例。

---

## 3. 新增仓库：`dsh-footer-panels`

**仓库**：<https://github.com/neil-wang-global/dsh-footer-panels>
**默认分支**：`main`
**可见性**：Public
**许可证**：MIT
**版本**：v1.0.0
**首次提交**：`db7369b` — `feat: promote footer plugins to global panel entries`

### 3.1 文件清单

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `client.js` | 211 | **核心**。浏览器侧实现：面板注册、开关桥接、状态同步 |
| `index.js` | 9 | 宿主侧空实现（占位，让 bundle 有可挂载的入口） |
| `cordis.patch.yml` | 4 | bundle 层，把自己的插件行插入 web roster |
| `package.json` | 53 | 包元信息 + `dsh.bundle` / `dsh.client` 声明 |
| `README.md` | 422 | 完整的安装与配置文档（中英混排，以中文为主） |
| `LICENSE` | 21 | MIT |
| `.gitignore` | 3 | 忽略 `node_modules` 等 |
| `locale/en.json` | 3 | 英文文案 |
| `locale/zh.json` | 3 | 中文文案 |

### 3.2 核心机制（`client.js`）

**① 配置驱动**

面板清单是一张表，不是代码分支：

```js
const DEFAULT_PANELS = [
  { panelId: 'pomasa-studio', label: 'POMASA Studio', order: 60,
    launcher: '[data-slot="sidebar.footer.action"] .ps-footer-action' },
  { panelId: 'dsh-pictor', label: 'Pictor', order: 61,
    launcher: '[data-slot="sidebar.footer.action"] .pt-footer-action' },
]
```

支持通过 bundle 配置 `config.panels` **覆盖/增补**（按 `panelId` 合并），无需改源码。

**② 注册面板（标准做法）**

- `sidebar.panellist` —— 在侧边栏全局面板列表注册一行（含图标、标签、排序）；
- `main` —— 用同一个 key 注册面板主体（空占位）。

与 DSH 内置面板（插件 / 任务看板 / 会话统计）**完全同构**。

**③ 借用插件自己的原生按钮来开关**

关键点：被皮肤隐藏的是**克隆体**，**原始节点仍在 DOM 上**，React 绑定的 `onClick` 也还在。

```js
const node = document.querySelector(panel.launcher)
node.click()
```

→ 工作台通过**插件自己的开关逻辑**打开/关闭，插件内部状态机不被绕过，不会出现状态漂移。

**④ 跟随面板选中状态**

```js
const active = ctx.get('layout').panelInfo.getSnapshot().activePanelId
```

选中则打开、离开则关闭。**用 120ms 轮询**而非订阅——该 observable 的接口形态在 DSH 各版本间不一致，漏掉一次会让 overlay 永久盖住界面，轮询更稳（每个 tick 仅读快照 + 比对一个 class）。

**⑤ 图标**

统一 16px / 1.4 描边 / `currentColor`，跟随主题色。两个示例各有语义化图标：

- POMASA Studio：一拖多的节点图（多智能体 MAS 调研系统）
- Pictor：画框里的太阳与山（图像 / 信息图渲染）

通过配置新增的 `panelId` 若未注册图标，回退到中性面板图标。

### 3.3 安装方式（写入 README）

两条路径，均已文档化：

- **方式 A（推荐）**：本地目录 + `link:` 协议。改三处 → `dsh plugin --profile web install` → 重启 `dsh web`；
- **方式 B**：GitHub git 依赖（`github:neil-wang-global/dsh-footer-panels#main`）。

README 中特别强调的坑：`dependencies` 与 `dsh.profile.bundles` **必须同时添加**（前者管能否解析，后者管是否加载）。

---

## 4. 对 DSH profile 的改动

**文件**：`~/.dsh/profiles/web/package.json`

仅两处：

```diff
  "dependencies": {
    ...
+   "dsh-footer-panels": "link:/Users/neil/Workspace/gwzn-repositories/dsh-footer-panels"
  },
  "dsh": {
    "profile": {
      "bundles": [
        ...
+       "dsh-footer-panels"
      ]
    }
  }
```

配套操作：

```bash
cd ~/.dsh/profiles/web && dsh plugin --profile web install
```

> 该命令会打印一批 `unmet peer` 警告，均来自其他插件（`@linxin666/dsh-web-ui-*` 等要求更新的 DSH peer），与本插件无关，不影响使用。

---

## 5. 两个插件：改动明细

### 5.1 POMASA Studio（`pomasa-studio` v0.1.0）

| 项目 | 内容 |
| --- | --- |
| **源码改动** | **无** |
| 文件验证 | `package.json` / `lib/client.js` / `src/client/main.js` mtime 均仍为 **2026-11-06 17:43:42**（安装时间） |
| 运行时行为变化 | 新增一个全局面板入口；原有底部按钮保留且功能不变 |
| 是否被绕过 | 否。开关仍走它自己的 `panel.toggle()` |

**交互原理**：本插件点击它的原始底部按钮 → 触发它自己的 `onClick` → 调用 `panel.toggle()` → `shell.overlay` 上的工作台开/关。

**唯一依赖**：它底部按钮的 class `.ps-footer-action`（若上游改名，只需在配置里改 `launcher`）。

### 5.2 Pictor（`dsh-pictor` v0.2.5）

| 项目 | 内容 |
| --- | --- |
| **源码改动** | **无** |
| 文件验证 | `package.json` / `lib/client.js` mtime 均仍为 **2026-11-06 16:17:07**（安装时间） |
| 运行时行为变化 | 新增一个全局面板入口；原有底部按钮保留且功能不变 |
| 是否被绕过 | 否。开关仍走它自己的 toggle |

**唯一依赖**：它底部按钮的 class `.pt-footer-action`。

### 5.3 dsh-claude-style（v0.19.9）

| 项目 | 内容 |
| --- | --- |
| **源码改动** | **无** |
| 配置改动 | 无（工作过程中曾临时加 `disabled` 标记用于复现，已完全还原） |
| 说明 | 本方案是**绕开**其页脚接管的失效点，而非修改它 |

---

## 6. 本次会话中临时改动过的文件（已全部还原）

为定位根因做过一次对照实验，下述改动**均已恢复原样**：

| 文件 | 临时改动 | 状态 |
| --- | --- | --- |
| `~/.dsh/profiles/web/package.json` | 反复增删 `dsh-claude-style` bundle 以复现故障 | ✅ 已确认最终包含该 bundle |
| `~/.dsh/profiles/web/cordis.patch.yml` | 临时加 `disabled: true` | ✅ 已删除，其余内容未动 |
| `~/.dsh/profiles/web/.bak-*` | 备份文件 | ✅ 已删除 |

---

## 7. 变更前后对比

### 侧边栏面板列表

| 变更前 | 变更后 |
| --- | --- |
| 插件 | 插件 |
| 自动化任务 | 自动化任务 |
| 会话统计 | 会话统计 |
| 任务看板 | 任务看板 |
| 智能体 | 智能体 |
| 更多 | **POMASA Studio**（新增） |
| — | **Pictor**（新增） |
| — | 更多 |
| …会话列表… | …会话列表… |
| **[POMASA Studio]（底部）** | [底部原按钮，保留但无需使用] |
| **[Pictor]（底部）** | [底部原按钮，保留但无需使用] |
| 今日用量 | 今日用量 |
| 设置 / 意见反馈 / 退出登录 | 设置 / 意见反馈 / 退出登录 |

### 行为差异

| 维度 | 变更前 | 变更后 |
| --- | --- | --- |
| 入口位置 | 侧边栏最底部 | 全局面板列表（可与内置面板同级） |
| 侧边栏收起时 | 不可访问 | 可从图标栏 / 「更多」访问 |
| 装 claude-style 后 | **完全无法打开** | 正常可用 |
| 面板内切换 | — | 切换到其他面板时自动收起 overlay |
| 是否可钉选 | 否 | 是（与内置面板一致） |

---

## 8. 已知限制

1. **依赖 DOM class**：`launcher` 选择器指向插件的 `.ps-footer-action` / `.pt-footer-action`。上游若改名需同步更新配置（改一行，不涉及插件源码）。
2. **轮询开销**：状态同步为 120ms 轮询，仅为读快照 + 比对 class，实测无感；若将来 DSH 提供稳定订阅接口可替换。
3. **面板主体为空**：工作台由插件自己画在 overlay 上，`main` 面板只是占位（避免同一组件挂载两次导致「看得见点不动」）。
4. **仅验证于 Web profile**：DSH `0.2.2-rc.1`。

---

## 9. 验证清单

| 验证项 | 结果 |
| --- | --- |
| `dsh --profile web --dump-config` 包含 `dsh-footer-panels` | ✅ |
| 无 `cannot resolve profile bundle` 报错 | ✅ |
| 面板列表出现 POMASA Studio + Pictor | ✅ |
| 点击 POMASA Studio 打开调研系统 | ✅ |
| 点击 Pictor 打开画布 | ✅ |
| 切换到其他面板后 overlay 收起 | ✅ |
| 图标随主题色 | ✅ |
| 仓库默认分支为 `main` | ✅ |
| 工作区 clean，已推送 | ✅ |
