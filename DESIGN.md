---
version: 1
name: ContextLines Side Panel
source: Raycast-inspired product chrome, adapted for a compact learning tool
colors:
  canvas: "#07080a"
  surface: "#0d0d0d"
  elevated: "#121314"
  raised: "#18191b"
  border: "#292b2e"
  border-strong: "#3a3d41"
  ink: "#f4f4f6"
  body: "#c8c9cc"
  muted: "#8c8f94"
  disabled: "#5f6267"
  primary: "#ffffff"
  on-primary: "#090a0b"
  info: "#79b8ff"
  success: "#72d69a"
  warning: "#f2c36b"
  danger: "#ff7a7a"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  heading:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body}"
  surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  surface-raised:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.md}"
  separator:
    backgroundColor: "{colors.border}"
    size: "1px"
  focus-ring:
    backgroundColor: "{colors.border-strong}"
    size: "2px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "36px"
  transcript-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  transcript-partial:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  input:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "40px"
  text-disabled:
    textColor: "{colors.disabled}"
    typography: "{typography.label}"
  status-info:
    textColor: "{colors.info}"
    typography: "{typography.label}"
  status-success:
    textColor: "{colors.success}"
    typography: "{typography.label}"
  status-warning:
    textColor: "{colors.warning}"
    typography: "{typography.label}"
  status-danger:
    textColor: "{colors.danger}"
    typography: "{typography.label}"
---

# ContextLines UI system

## Overview

ContextLines should feel like a focused desktop utility, not a streaming overlay or marketing page. The visual language is adapted from Raycast's product chrome: near-black canvas, a restrained surface ladder, 1px borders, compact spacing, and one white primary action. It deliberately excludes Raycast's red launch stripes, decorative feature cards, gradients, app-tile colors, and marketing-scale typography.

## Typography

- Apply `font-feature-settings: "calt", "kern", "liga", "ss03"` globally.
- Use 14px body text, 12px labels, and 15px headings. The captured English line may use 16px for reading comfort.
- Chinese explanatory text uses the same system stack and 1.6 line height. Avoid uppercase section titles except tiny state badges.

## Layout

- The Side Panel is a single continuous dark canvas with a sticky 44px header, compact mode tabs, one scroll region, and a bottom action area only when the current task needs it.
- At 320px, use 12px page gutters and single-column controls. At 400px, keep the same hierarchy with 16px gutters. At 600px, analysis fields may form two columns only when labels remain readable.
- Surfaces communicate grouping, not decoration. Use at most three nested surface levels and never use drop shadows.
- Transcript rows are list items, not cards. Final lines are high-emphasis and clickable; partial text is muted and cannot trigger analysis.

## Interaction

- Keep all primary controls at least 36px high and icon-only targets at least 32px with an accessible label.
- White is reserved for the single primary action in the current view. State colors are limited to a small dot, badge, or validation message.
- Keyboard focus uses a 2px outline in `{colors.info}` with 2px offset. Never rely on color alone for status.
- Loading preserves layout. Disable duplicate submits and show the current action in text.

## Product states

- Idle: source summary, privacy note, and one “开始识别” action.
- Capturing: persistent status dot, source title/origin, stop action, recent English lines, muted partial line.
- Analysis: selected line remains visible above quick analysis. Chunks are compact selectable rows, not colorful tags.
- Save: selected chunk and required personal example are explicit; empty example displays inline validation and cannot submit.
- Review: prompt first, answer hidden; reveal is explicit, then four self-rating buttons appear.
- Errors: a plain inline problem panel states what happened, whether retry is safe, and how to recover. Restricted pages never offer bypass actions.

## Content rules

- Never display generated Chinese until the user clicks a final line.
- Never display speaker labels or inferred identities.
- Render `external_fact` with the literal label “外部事实，未联网核实”. Do not render citations because the MVP does not browse.
- Confidence is secondary metadata, not a score that dominates the explanation.

## Do

- Use the canvas/surface/elevated/raised ladder and 1px borders.
- Keep transcripts as a dense readable list with stable line positions.
- Make destructive or session-ending actions explicit and text-labeled.
- Verify 320px, 400px, and 600px widths after visible changes.

## Don't

- Do not add red marketing stripes, chromatic gradients, glow, glassmorphism, or drop shadows.
- Do not build a grid of decorative cards or use multicolor brand accents.
- Do not put every sentence in a pill. Pills are reserved for compact state and mode selection.
- Do not hide capture status, source, validation, or external-fact classification behind hover-only UI.

## Iteration

Run `pnpm design:lint` after edits. When adding a component, first express it with existing tokens. Add a token only when the same semantic need appears in more than one place.
