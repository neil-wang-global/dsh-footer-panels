# dsh-footer-panels

**把插件的入口从「挤在侧边栏底部」提升到「全局面板列表」。**

一个配置驱动的 DSH（DeepSeek Harness）Web 插件：只改一份索引表，就能把任意挂在侧边栏底部的插件入口，变成侧边栏顶部「全局面板」里的一等公民。

[POMASA Studio](https://github.com/eXtremeProgramming-cn/pomasa-studio) 和 [Pictor](https://www.npmjs.com/package/dsh-pictor) 是本仓库附带的**两个示例**，不是它的适用范围。

> **不修改任何第三方插件的源码。** 本插件只借用 DSH 的公开插槽与布局服务，为它们补一个入口。

---

## 目录

- [它解决什么问题](#它解决什么问题)
- [核心机制：配置驱动](#核心机制配置驱动)
- [效果对比](#效果对比)
- [随附示例](#随附示例)
- [工作原理](#工作原理)
- [安装](#安装)
  - [前置条件](#前置条件)
  - [方式 A：本地目录安装（推荐，适合开发者）](#方式-a本地目录安装推荐适合开发者)
  - [方式 B：从 GitHub 安装](#方式-b从-github-安装)
  - [验证安装](#验证安装)
  - [卸载](#卸载)
- [配置：添加你自己的面板](#配置添加你自己的面板)
- [常见问题](#常见问题)
- [兼容性](#兼容性)
- [License](#license)

---

## 它解决什么问题

DSH 允许插件在侧边栏底部放一个按钮，对应的插槽是 `sidebar.footer.action`。这类插件通常把工作台画在 `shell.overlay` 图层上，靠那个底部按钮开关。

这个位置有三个天然的毛病：

1. **挤。** 底部区域要同时容纳设置、反馈、退出登录等系统项，插件越多越窄，最后被塞进「更多」里；
2. **低。** 它是侧边栏最不起眼的位置，功能一旦常用，每次都要往下找；
3. **脆。** 任何对底部区域做二次加工的皮肤插件都可能把它弄坏。

第 3 点是真实的：**[dsh-claude-style](https://www.npmjs.com/package/dsh-claude-style) 的「页脚接管」（footer takeover）会让这类按钮彻底失效。**

它的做法是：

1. 遍历页脚里的每个条目，**克隆一份**塞进账号弹层（点左下角用户名弹出的菜单）；
2. 用 CSS 把**原始按钮隐藏**；
3. 给克隆体挂点击转发时，需要把镜像节点**逐层映射回源节点**。

而 POMASA Studio 和 Pictor 的页脚组件，可点击的元素是**嵌套在内部**的，不是条目根节点 —— 层级映射对不上，转发返回 `null`，点击被 `stopPropagation()` 吞掉。

```
装了 claude-style 之后：
  账号弹层 ──► [POMASA Studio]   ← 克隆体，看着能点，其实没反应
  侧边栏底部 ──► （原按钮已被 CSS 隐藏）
```

于是插件从界面上「消失」了。

本插件的答案是：**别依赖那个位置。给它们一个正式的全局面板入口。**

## 核心机制：配置驱动

本插件的全部内容就是一张表。每个条目把一个底部按钮「提升」为一个面板：

```js
{
  panelId: 'pomasa-studio',                 // 面板 key，全局唯一
  label: 'POMASA Studio',                   // 显示名
  order: 60,                                // 排序，越小越靠上
  launcher: '... .ps-footer-action',        // 该插件自己那个底部按钮的选择器
}
```

- 想再接一个插件？**加一行**，不用改逻辑；
- 想调顺序？**改 `order`**；
- 想停用某个面板？**删掉那一行**。

这张表有默认值（就是本仓库附带的两个示例），也可以在 profile 的 bundle 配置里覆盖，**不需要改动任何源码**：

```yaml
- id: footer-panels
  name: dsh-footer-panels
  config:
    panels:
      - panelId: my-plugin
        label: 我的插件
        order: 70
        launcher: '[data-slot="sidebar.footer.action"] .my-plugin-footer'
```

所以本插件本质上是一个**通用机制 + 一份示例清单**。POMASA Studio 和 Pictor 只是把这份清单填起来，证明它能用。

## 效果对比

```
改造前（依赖底部按钮）            改造后（全局面板列表）
┌──────────────────────┐         ┌──────────────────────┐
│ 插件                 │         │ 插件                 │
│ 自动化任务           │         │ 自动化任务           │
│ 会话统计             │         │ 会话统计             │
│ 任务看板             │         │ 任务看板             │
│ 智能体               │         │ 智能体               │
│                      │         │ POMASA Studio  ← 新  │
│ ...会话列表...       │         │ Pictor         ← 新  │
│                      │         │ 更多                 │
│ [POMASA Studio]      │  ← 挤   │                      │
│ [Pictor]             │  ← 挤   │ ...会话列表...       │
│ 今日用量             │         │                      │
│ 设置 意见反馈 退出   │         │ [原按钮仍在，但可不用]│
└──────────────────────┘         └──────────────────────┘
```

提升之后：

- 出现在「全局面板」列表顶部区域，和内置面板同级，可以被钉选 / 取消钉选；
- 进入「更多」菜单，侧边栏收起时也能从图标栏访问；
- 图标为 16px 描边图标，跟随主题色，与内置面板视觉一致；
- 选中即打开工作台，**切到别的面板时自动收起**，overlay 不会一直盖在界面上。

## 随附示例

| 图标 | 面板 | 含义 | `launcher` |
| --- | --- | --- | --- |
| 一拖多的节点图 | POMASA Studio | 多智能体（MAS）调研系统 | `.ps-footer-action` |
| 画框里的太阳与山 | Pictor | 图像 / 信息图渲染 | `.pt-footer-action` |

## 工作原理

三件事，全部走 DSH 的公开接口。

**1. 注册面板（标准做法）**

和内置面板完全一致：在 `sidebar.panellist` 插槽注册一行启动器，在 `main` 插槽用同一个 key 注册面板主体。

```js
slots.inject('sidebar.panellist', () =>
  slots.register(
    { name: 'sidebar.panellist', id: panel.panelId, order: panel.order, label: panel.label },
    PanelIcon,
  ),
)
```

**2. 借用插件自己的原生按钮来开关工作台**

被皮肤接管的是底部条目的**克隆体**，而**原始节点仍然挂在 DOM 上**（只是被 CSS 隐藏），React 绑定的 `onClick` 也还在。

所以本插件只是对原始节点调用 `.click()`：

```js
const node = document.querySelector(panel.launcher)
node.click()
```

工作台由此通过**插件自己的开关逻辑**打开/关闭 —— 插件内部的 `open` 状态机不会被绕过，也就不存在状态漂移。这是「不修改源码」还能正确驱动它的关键。

**3. 跟随面板选中状态**

通过 `ctx.layout.panelInfo` 读取当前选中的面板：

```js
const active = ctx.get('layout').panelInfo.getSnapshot().activePanelId
```

选中哪个面板就打开哪个工作台，离开就关闭。这里用短间隔轮询而不是订阅，是因为该 observable 的接口形态在不同 DSH 版本间存在差异；**漏掉一次状态变化会让 overlay 一直盖住界面**，轮询更稳。每个 tick 只读一次快照、比对一个 class，开销可以忽略。

**判断开关状态**：这类插件都会在打开时给自己的底部按钮加上 `on` class，本插件读取它，而不是自己记一份状态。

```js
const open = node.getAttribute('aria-expanded') === 'true' || node.classList.contains('on')
```

### 为什么面板主体是空的？

插件的工作台是注册在 `shell.overlay` 上的有界浮层，位置由它自己计算。

如果本插件把同一个工作台组件再渲染一份到 `main` 面板里，等于让组件挂载两次，而插件的开关状态是单例的 —— 会出现「看得见但点不动」的副本。所以面板主体只是一个**空占位**，真正的界面始终由插件自己画在 overlay 上。

## 安装

### 前置条件

- DSH **0.2.2-rc.1** 或更高版本（Web profile）
- 已安装并启用你要提升的插件（默认清单里是 `pomasa-studio` 和 `dsh-pictor`）
- 装了 **dsh-claude-style** 才是典型场景；没装皮肤时底部按钮本来就能用，本插件只是额外提供面板入口

先确认 profile 能正常启动：

```bash
dsh --profile web --dump-config >/dev/null
```

### 方式 A：本地目录安装（推荐，适合开发者）

适合从源码改、想随时看到改动的情况。DSH 的 profile 本身是一个 pnpm 工程（`$DSH_HOME/profiles/web`），用 `link:` 协议指向本地目录即可。

**1. 克隆仓库到任意位置**

```bash
git clone https://github.com/neil-wang-global/dsh-footer-panels.git \
  ~/Workspace/gwzn-repositories/dsh-footer-panels
```

**2. 在 profile 里登记依赖与 bundle**

编辑 `~/.dsh/profiles/web/package.json`，两处都要改：

```jsonc
{
  "dependencies": {
    // ...保持原有依赖不动，追加这一行（路径换成你的实际路径）
    "dsh-footer-panels": "link:/Users/<you>/Workspace/gwzn-repositories/dsh-footer-panels"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ...保持原有列表顺序不动，追加这一项
        "dsh-footer-panels"
      ]
    }
  }
}
```

> **两个列表缺一不可：**
> - `dependencies` 决定包**能不能被解析到**；
> - `dsh.profile.bundles` 决定这个 bundle **会不会被加载**。
>
> 只加 `dependencies` 不会生效；只加 `bundles` 会报 `cannot resolve profile bundle`。

**3. 安装依赖（把 local link 接上）**

```bash
dsh plugin --profile web install
```

等价于在 `~/.dsh/profiles/web` 里跑 `pnpm install`。

> 这一步可能打印一批 `unmet peer` 警告（来自其他插件，例如 `@linxin666/dsh-web-ui-*` 要求更新的 DSH peer）。与本插件无关，**只要最后出现 `+ dsh-footer-panels` 且退出码为 0 即可**。

**4. 重启 DSH Web**

```bash
dsh web
```

改 `package.json` 的 `bundles` 需要重启进程；只改 `client.js` 时，刷新页面即可（热重载）。

### 方式 B：从 GitHub 安装

不想要本地目录、直接跟仓库走，用 git 依赖：

编辑 `~/.dsh/profiles/web/package.json`：

```jsonc
{
  "dependencies": {
    "dsh-footer-panels": "github:neil-wang-global/dsh-footer-panels#main"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-footer-panels"
      ]
    }
  }
}
```

然后同样执行：

```bash
dsh plugin --profile web install
dsh web
```

> 本插件没有构建步骤（源码就是发布物），git 依赖不需要 `prepare` 脚本。
> 想固定版本可用 `#v1.0.0` 这类 tag 代替 `#main`。

### 验证安装

**1. 确认 bundle 被打进配置**

```bash
dsh --profile web --dump-config | grep -A2 footer-panels
```

应看到：

```yaml
# == dsh-footer-panels
- id: footer-panels
  name: dsh-footer-panels
```

若看到 `skipping profile bundle "dsh-footer-panels": cannot resolve ...`，说明没跑第 3 步的 `install`。

**2. 确认界面出现**

刷新 `http://127.0.0.1:3080`，左侧「全局面板」区域应多出 **POMASA Studio** 和 **Pictor** 两行。点一下，对应工作台应当打开。

### 卸载

1. 从 `package.json` 的 `dsh.profile.bundles` 里删掉 `"dsh-footer-panels"`；
2. 从 `dependencies` 里删掉对应行；
3. 执行 `dsh plugin --profile web install`；
4. 重启 `dsh web`。

## 配置：添加你自己的面板

默认清单写在 `client.js` 的 `DEFAULT_PANELS`。有两种方式扩展。

### 方式 1：改默认清单（适合要提交回仓库）

在 `DEFAULT_PANELS` 追加一项：

```js
const DEFAULT_PANELS = [
  // ...已有的两项
  {
    panelId: 'my-plugin',
    label: '我的插件',
    order: 62,
    launcher: '[data-slot="sidebar.footer.action"] .my-plugin-footer',
  },
]
```

### 方式 2：bundle 配置覆盖（不改源码）

在 `~/.dsh/profiles/web/cordis.patch.yml` 里覆盖：

```yaml
- id: footer-panels
  name: dsh-footer-panels
  config:
    panels:
      - panelId: my-plugin
        label: 我的插件
        order: 70
        launcher: '[data-slot="sidebar.footer.action"] .my-plugin-footer'
```

配置项按 `panelId` 与默认清单**合并**（覆盖同名字段），所以既可以只改某个示例的顺序，也可以纯新增。

### 怎么找到 `launcher` 选择器

1. 打开 `http://127.0.0.1:3080`，按 F12 进入 devtools；
2. 找到你想提升的那个底部按钮，看它的 class；
3. 用「插槽容器 + 插件自己的 class」组合，例如：

```js
document.querySelector('[data-slot="sidebar.footer.action"] .ps-footer-action')
```

返回 `null` 说明选择器不对或插件没挂载。**必须指向插件自己的原始按钮**，不要指向皮肤克隆出来的那份。

### 图标

`ICONS` 里按 `panelId` 注册图标，`glyph()` 会套上统一的 16px / 1.4 描边 / `currentColor` 外壳，只需传内部图形：

```js
const ICONS = {
  'my-plugin': () => glyph([h('circle', { key: 'c', cx: 8, cy: 8, r: 5 })]),
}
```

没有注册图标的 `panelId` 会使用中性的默认面板图标（不会报错）。

## 常见问题

**Q：点了面板，但工作台没打开？**

按顺序检查：

1. 对应插件是否真的装了且在运行 —— `dsh --profile web --dump-config | grep -E 'pomasa-studio|dsh-pictor'`；
2. 页脚里是否存在那个原生按钮 —— devtools 执行
   `document.querySelector('[data-slot="sidebar.footer.action"] .ps-footer-action')`，
   返回 `null` 说明插件没挂载或改了 class；
3. 插件升级若改了按钮 class，同步改 `launcher` 即可，不用改插件源码。

**Q：没装 claude-style，需要这个插件吗？**

不需要。没有页脚接管时，底部按钮本来就工作正常。本插件此时只是额外提供面板入口，装了也无害。

**Q：会不会和 claude-style 冲突？**

不会。claude-style 只管底部条目的克隆与隐藏，而本插件注册在 `sidebar.panellist`（全局面板列表）和 `main`（中栏）插槽，两者不重叠。

**Q：和插件自己的底部按钮会互相干扰吗？**

不会。两边共用同一个开关，本插件只是「代它点击」并在面板切换时同步关闭，始终以原生按钮的 `on` class 为准，不会出现两份状态。

**Q：面板打开时中间栏是空白的？**

正常。工作台是插件自己画在 overlay 层的浮层，覆盖在中栏之上；空白的中栏在浮层下方，不可见。

**Q：`dsh plugin --profile web install` 报一堆 `unmet peer` 警告？**

与本插件无关，来自其他插件的 peer 声明。只要最后有 `+ dsh-footer-panels` 且退出码为 0 就不影响使用。

**Q：改了 `client.js` 没生效？**

刷新页面（热重载在页面重新加载时应用）。若改了 `package.json` 的 `bundles`，则必须重启 `dsh web`。

## 兼容性

| 项目 | 说明 |
| --- | --- |
| DSH | web profile，`0.2.2-rc.1` 验证通过 |
| POMASA Studio | `0.1.0` 验证通过（示例） |
| Pictor | `0.2.5` 验证通过（示例） |
| dsh-claude-style | `0.19.9` 验证通过 |
| 平台 | DSH Web（浏览器侧插件，纯 DOM + React，无宿主端逻辑） |

唯一依赖的 DOM 契约是插件的底部按钮 class（示例中为 `.ps-footer-action` / `.pt-footer-action`）。上游若改名，改 `launcher` 一处即可，不需要改任何插件源码。

## License

[MIT](./LICENSE)
