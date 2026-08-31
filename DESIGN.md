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

界面只使用一张不超过 360px 的右上角深色浮层，直接显示在网页或全屏播放器内部，不抢焦点。按 `Alt+Q` 时立即暂停面积最大的可见视频，浮层顶部显示暂停时间点；关闭浮层时恢复由扩展暂停的视频。正文始终展示识别到的完整英文和对应的整句中文，并在英文原句中用蓝、紫、橙三种克制色高亮最多三个值得解释的表达；下方按相同颜色只显示“英文表达 → 简短中文”。不再生成或展示重复的语境、用法和完整转录折叠区。状态提示使用琥珀色。颜色只区分信息角色，不作为装饰。右上角提供关闭按钮，底部提供“关闭并继续播放”，再按 `Alt+Q` 也能关闭。不显示侧栏、模式导航、收藏、复习、渐变或装饰卡片。所有解释应能在一次扫读中看完。

首次设置页采用单列 520px 布局，只显示个人 Worker 地址、随机连接口令和一个检查保存按钮。明确说明模型密钥只在 Cloudflare Secrets 中，Chrome 不保存模型密钥。
