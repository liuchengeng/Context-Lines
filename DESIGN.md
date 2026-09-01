---
version: 1
name: ContextLines Quick Ask
colors:
  canvas: "#08090a"
  surface: "#101113"
  border: "#292b2e"
  ink: "#f5f5f5"
  body: "#c8c9cc"
  muted: "#85888d"
  primary: "#f5f5f5"
  on-primary: "#090a0b"
rounded:
  sm: "7px"
  md: "9px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
typography:
  body:
    fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
  heading:
    fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.4
---

# Quick Ask UI

界面只使用一张不超过 360px 的右上角深色浮层，直接显示在网页或全屏播放器内部，不抢焦点。按 `Alt+Q` 时立即暂停面积最大的可见视频，浮层顶部显示暂停时间点；关闭浮层时恢复由扩展暂停的视频。豆包返回后先显示识别到的英文片段和“正在生成中文和短语”，DeepSeek 返回后原位补充更醒目的中文理解，并在英文片段中用蓝、紫、橙三种克制色高亮最多三个值得解释的单词或短语；没有合适内容时只显示中文，不填充无用解释。下方按相同颜色只显示“英文表达 → 简短中文”，每项提供克制的手动收藏按钮。状态提示使用琥珀色。颜色只区分信息角色，不作为装饰。右上角提供关闭按钮，底部提供“关闭并继续播放”，再按 `Alt+Q` 也能关闭。不显示侧栏、模式导航、自动历史、渐变或装饰卡片。所有解释应能在一次扫读中看完。

首次设置页采用单列 520px 布局，只显示个人 Worker 地址、随机连接口令和一个检查保存按钮。明确说明模型密钥只在 Cloudflare Secrets 中，Chrome 不保存模型密钥。

词单采用不超过 720px 的单列页面。顶部只显示标题、隐私说明和连接设置入口；下方逐行显示英文、中文意思、单词或短语标签及删除按钮。没有搜索、筛选、统计、复习模式或装饰卡片。
