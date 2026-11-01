---
name: yizhiyu的小站
description: 编辑杂志风的个人博客与 Agent 作品集
colors:
  paper: "#f9f8f6"
  ink: "#1c1c1c"
  ink-deep: "#171411"
  warm-sand: "#d4a373"
  warm-sand-ink: "#8f6036"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", "SimSun", serif'
    fontSize: "3.75rem"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", "SimSun", serif'
    fontSize: "3rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", "SimSun", serif'
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "1rem"
    fontWeight: 450
    lineHeight: 1.7
  label:
    fontFamily: '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.15em"
rounded:
  none: "0px"
spacing:
  "2": "8px"
  "4": "16px"
  "6": "24px"
  "10": "40px"
  "14": "56px"
  "20": "80px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "2px 0"
  nav-link-active:
    textColor: "{colors.warm-sand-ink}"
  source-chip:
    backgroundColor: "transparent"
    textColor: "rgba(28, 28, 28, 0.7)"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
---

# Design System: yizhiyu的小站

## Overview

**Creative North Star: "The Quiet Editorial"**

This is a site that earns trust by typesetting, not by decoration. The page behaves like a well-set printed journal read on warm paper: one ink, one paper, one warm accent used like a single editorial mark. Nothing floats, nothing glows, nothing is rounded. Authority comes from the type being set correctly — a serif voice for what the site has to say, a sans voice for the machinery around it — and from the confidence of wide margins and 1px rules.

The system is deliberately lean because the product is a job-hunting portfolio disguised as a personal blog. A recruiter should read the first screen in seconds; the quietness is what makes the Agent capability (a live assistant, streaming answers, tool calls) feel credible rather than promotional. The editorial restraint is also the engineering argument: the site does not need visual noise to hold attention.

The interface is mostly hand-set Tailwind typesetting over three tokens, with the navigation and home page serving as the canonical expression. Every surface — public pages, the assistant, login, and the admin console — now follows this system.

**Key Characteristics:**
- Two colors of substance — warm paper (#f9f8f6) and soft ink (#1c1c1c) — plus one warm accent (#d4a373).
- Strictly rectilinear: 0px radius, 1px hairline borders, never a shadow.
- Two type voices: light serif for headings and content titles, sans for navigation, labels, meta, and body.
- Depth through rules, whitespace, and ink opacity — never through elevation.
- Accent is rare: the active navigation item is its only routine home.
- A graphic layer made of type and paper, not imagery: a faint paper grain, 2.5rem Warm Sand section rules, a cropped oversized serif hero mark, and a marker-sweep hover.
- Dark cover bands (home hero, article header) alternate with Paper, and a closing Deep Ink band ends the home page, giving it a magazine cover-to-back-cover rhythm without introducing a second hue.
- Generous vertical rhythm: 56–112px section spacing, wide margins, long-form line height 1.7–1.8.

## Colors

A single warm neutral pair with one restrained accent; the palette's whole character is restraint.

### Primary
- **Warm Sand** (#d4a373): the chromatic mark itself — 1px rules, underlines, and small decorative strokes. It is never set as small text because it only reaches 2.1:1 on Paper.
- **Warm Sand Ink** (#8f6036): the same hue deepened for text. Every warm accent that carries words — the active navigation item, small marks that must be read — uses this tone, which clears 4.5:1 on Paper.

### Neutral
- **Paper** (#f9f8f6): the page ground. Not pure white — it carries a faint warm cast so long reading feels like paper rather than a screen.
- **Ink** (#1c1c1c): text, borders, and rules. Soft black, never #000. All secondary text is Ink with opacity, not a separate gray.
- **Deep Ink** (#171411): the full-bleed cover field behind the home hero and article header. Warmer and deeper than Ink; Paper text and Warm Sand marks sit on it. Never used as body text on Paper, never as a gradient.

### Named Rules
**The One Warm Voice Rule.** Warm Sand and Warm Sand Ink together cover ≤10% of any screen. Text uses Warm Sand Ink (#8f6036); Warm Sand (#d4a373) is reserved for 1px rules and non-text marks. Never use either for body text, large fills, or a second competing accent.

**The Ink Ladder Rule.** There are no gray tokens. Secondary and tertiary text is Ink at 90 / 70 / 40 percent; hairlines and tint washes are Ink at 10 / 5 percent. Introducing a slate or gray hex is a system violation.

## Typography

**Display Font:** Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", "SimSun", serif
**Body Font:** "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New" (code and backend status only)

**Character:** A two-voice editorial pairing. The serif carries ideas and titles at light weights (300–400); the sans carries the interface at a slightly firm 450 so Chinese body text stays legible. Headings are set tight (-0.025em); labels are opened wide (0.15–0.25em) to read as editorial captions.

### Hierarchy
- **Display** (300, 3rem → 3.75rem at md, line-height 1.05, tracking -0.025em): the home hero name only. One per page.
- **Headline** (300, 2.25rem → 3rem, line-height 1.1): page titles such as AI 新闻. One per surface.
- **Title** (400, 1.25rem → 1.5rem, line-height 1.375): article and news item titles, section headings (1.5rem → 1.875rem for section h2).
- **Body** (450, 1rem / 1.7; long-form summary 1.125rem / 2rem): reading copy. Keep prose measure around 65–75 characters.
- **Label** (500, 0.75–0.875rem, tracking 0.15–0.25em): navigation, dates, meta, source chips, eyebrows. Never set a label in serif.

### Named Rules
**The Two-Voice Rule.** Serif for headings and content titles; sans for navigation, labels, buttons, metadata, and body. Never set a button or label in serif, and never set a heading in sans.

## Layout

The shell is a centered reading column of 56rem (896px) with 24px side padding on mobile and 48px from the md breakpoint (768px). Wide editorial pages may opt out to 72rem (1152px) — the AI 新闻 page does; the navigation bar uses the wide width even when the content column is narrow. Sections stack vertically and are separated by 1px Ink/10 rules rather than by cards.

Vertical rhythm: hero sections 80px → 112px; standard sections 56px → 64px; list rows 24px vertical padding; 24px between stacked items. The rhythm is consistent enough that pages feel like continuations of one publication, not separate screens.

Responsive behavior is type-first: the md breakpoint mainly increases heading sizes, side padding, and section spacing. The navigation wraps to a second row on narrow screens without changing type scale.

## Elevation & Depth

This system is flat by doctrine. There are no shadows, no rounded corners, and no elevated surfaces at rest or in any state. Depth is conveyed entirely through 1px Ink hairlines at 10% opacity, whitespace, type weight, and a 5% Ink hover wash. State changes are opacity and color shifts, not lifting.

### Named Rules
**The Flat-By-Default Rule.** Zero radius and zero shadow, always. If two surfaces need separation, use a 1px Ink hairline at 10% or more whitespace — never a box-shadow.

## Shapes

Strictly rectilinear. Every corner is square (0px); there are no pills, no rounded cards, and no circular chrome in the Editorial system. Borders are 1px hairlines; selected article rows use a 2px left rule. The one recurring motion is an underline scaling from 0 to full width over 400ms, which reads like a rule being drawn on paper.

## Components

### Buttons
- **Shape:** square (0px radius), 1px Ink border.
- **Primary:** transparent fill with Ink text and a 1px Ink border, label typography (0.875rem, tracking 0.15em), 12px 24px padding. Used sparingly — the home hero's "和 AI 助手聊聊 →".
- **Hover / Focus:** inverts to Ink fill with Paper text in 150ms; focus-visible uses a 1px Ink outline with 3px offset. No shadow, no movement.
- **Secondary / Ghost:** text links carry a 1px bottom border at Ink/30 instead of a box.

### Chips
- **Source chip:** square, transparent fill, 1px Ink/20 border, Ink/70 label text, 2px 8px padding, tracking 0.15em. Used for news source attribution; it reads as a printed caption, not a tag.

### Cards / Containers
- **No cards.** Editorial surfaces never wrap content in cards. Sections are separated by 1px Ink/10 rules and whitespace. This absence is deliberate: a card would re-introduce the boxed, dashboard-like feel the system rejects.

### Inputs / Fields
No Editorial input pattern exists yet. New inputs should follow the Flat + hairline doctrine (square, 1px Ink border, transparent or Paper fill) rather than inheriting the legacy 8px-radius gray fields. Treat this as provisional guidance until the first Editorial form is built.

### Navigation
- Sticky at the top, Paper fill, 1px Ink/10 bottom border, 20–24px vertical padding.
- **Logo:** serif, normal weight, 1.125–1.25rem, tracking 0.2em — the site name as a masthead.
- **Links:** sans label, 500 weight, Ink at 70% opacity at rest; full Ink on hover. An underline scales in from the right over 400ms. The active route is the only place Warm Sand appears, as colored text.
- **Mobile:** wraps to two rows at narrow widths; type scale and states stay identical.

### Signature: Section Header
The home page's repeating rhythm: a 2.5rem Warm Sand rule (1.5rem on mobile) before a light serif h2, with a right-aligned sans caption or "全部 →" link at Ink/60 and 0.2em tracking, sitting above a hairline. It behaves like a magazine section opener.

### Signature: Article Row
Article lists are rows, not cards: a 2px left rule at Ink/10 that darkens to Ink/40 on hover, a 5% Ink wash, 24px vertical padding, and 20–32px left padding. On hover a Warm Sand marker band sweeps across the title over 450ms — the system's one expressive gesture.

### Signature: Hero Mark
An oversized italic serif "Y" (clamp 15–28rem) sits at the hero's right edge in Warm Sand at 16% opacity and is cropped by the section. It is a watermark: `aria-hidden`, pointer-events none, never content. On mobile it drops to 14rem at 12%.

### Signature: Article Folio & Standfirst
Article detail opens with a real folio ("NO. 09") set in Warm Sand on the dark cover, and the summary is an italic serif standfirst with a 2.5rem Warm Sand opening quote in the left margin (hidden on mobile).

### Signature: Cover Band
A full-bleed Deep Ink field opens the home page and every article, and a matching band closes the home page. It runs edge to edge via `margin-inline: calc(50% - 50vw)` with matching padding so its content still aligns to the 56rem reading column; a 1px Warm Sand rule marks its opening or closing edge. Headings switch to Paper, secondary text to Paper/70, and the oversized serif mark keeps Warm Sand. The closing band carries a serif "最近更新" heading and the latest article/moment rows, plus a lowercase italic "y" watermark; never round, shadow, or gradient the band.

## Do's and Don'ts

### Do:
- **Do** build every new public page from Paper, Ink, and Warm Sand only; keep the accent at or below 10% of the screen.
- **Do** set headings in the serif stack at light weights and everything functional in the sans stack.
- **Do** separate sections with 1px Ink/10 hairlines and whitespace instead of cards, shadows, or background changes.
- **Do** use the ink opacity ladder — 90 / 60 / 40 / 10 percent — for hierarchy; never add a gray token.
- **Do** keep corners square and hover feedback to color, opacity, and 1px rules.
- **Do** use Warm Sand Ink (#8f6036) whenever the warm accent carries text; #d4a373 is for 1px rules and non-text marks only.
- **Do** build graphics from type and paper — grain, 1px Warm Sand rules, oversized serif marks, marker sweeps — rather than imagery or effects.
- **Do** use 56–112px section spacing and a 56rem reading column so pages feel like one publication.

### Don't:
- **Don't** introduce `#2563eb` blue, `#e5e7eb` gray borders, 8–12px radii, white cards, or colored pill badges. These were the pre-migration pattern; every surface is now Editorial, and this look is anti-reference rather than a second system to extend.
- **Don't** add box-shadows, elevation, glassmorphism, gradients, or glow effects at any state.
- **Don't** use Warm Sand for large fills, body text, or more than one competing accent; its rarity is the point.
- **Don't** use emoji as ornament or iconography on Editorial surfaces (the legacy ⭐ / ✅ / 🔧 style stays with the legacy pages until they are migrated).
- **Don't** set buttons, labels, or metadata in the serif face, or headings in the sans face.
- **Don't** wrap Editorial content in rounded cards or dashboard panels; if a block needs separation, reach for a hairline or space.
