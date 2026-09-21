# UI/UX Specification

## 1. Screens

### 1. Landing

Contains:

- product name;
- concise purpose;
- disclaimer;
- jurisdiction selector;
- language selector;
- chat entry.

### 2. Chat

Components:

```text
Header
  jurisdiction toggle
  language
  profile

Chat history

Composer
  text input
  mic
  send

Answer card
  answer
  citations
  confidence
  next steps
  escalate
```

### 3. Classification card

Show only necessary follow-ups:

```text
To narrow the applicable route:
[Question]
[Option A] [Option B] [Not sure]
```

### 4. Evidence drawer

When the user clicks a citation:

```text
Authority
Document
Section/Rule/Article
Version date
Page
Source URL
Retrieved date
```

### 5. Escalation modal

Ask for:

- reason;
- optional additional context;
- contact details only if necessary;
- consent.

## 2. Visual principles

Do:

- clean legal/research feel;
- clear evidence hierarchy;
- large readable answer text;
- strong distinction between "answer" and "source";
- prominent India/international state.

Avoid:

- "100% correct" badges;
- fake legal authority visuals;
- unexplained AI confidence bars;
- hidden disclaimers.

## 3. Answer card anatomy

```text
┌────────────────────────────────────┐
│ Guidance                            │
│                                     │
│ Main answer paragraph...            │
│                                     │
│ Why                                  │
│ • ...                               │
│                                     │
│ Evidence                             │
│ [EV-01] IP India — Patents Act §3(p)│
│ [EV-02] ...                         │
│                                     │
│ Confidence: System score 0.81       │
│ Missing info: ...                   │
│                                     │
│ [View source] [Ask expert]          │
└────────────────────────────────────┘
```

## 4. Accessibility

- WCAG-oriented contrast.
- Keyboard support.
- ARIA labels.
- focus management.
- captions/transcripts for voice.
- language selector with visible language name.
- do not rely on color alone for confidence/safety state.

## 5. Mobile

The product should be responsive/PWA-friendly.

Voice control must be usable with one hand.

Evidence should open as an expandable sheet rather than a side panel.
