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

# UI rules

## Quick Ask overlay

- Use one dark overlay in the top-right corner, no wider than 360 px.
- Render inside the page or fullscreen element without taking focus.
- Pause the largest visible video on `Alt+Q` and show the playback time.
- Show the English transcript first, followed by the Chinese translation.
- Highlight no more than three useful terms. Reuse the same blue, purple, and orange colors in the term list.
- Use amber only for status and warning messages.
- Closing the overlay resumes only the video paused by the extension.
- Do not add sidebars, gradients, navigation modes, automatic history, or decorative cards.

## Settings

Use a single column no wider than 520 px. Show only the Worker URL, relay token, connection check, and a link to the vocabulary page.

## Vocabulary

Use a single column no wider than 720 px. Each row shows the English term, Chinese meaning, type, and delete action. Do not add search, filters, statistics, or review features.
