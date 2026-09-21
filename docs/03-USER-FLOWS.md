# User Flows

## 1. Main text-chat flow

```text
Landing
  ↓
Choose jurisdiction (India / International)
  ↓
Enter question
  ↓
System detects language
  ↓
Is product context sufficient?
  ├─ No → ask 1–2 targeted questions
  └─ Yes
        ↓
Product classification
        ↓
Legal-domain routing
        ↓
Retrieve evidence
        ↓
Optional live registry lookup
        ↓
Generate grounded explanation
        ↓
Verify citations
        ↓
Confidence decision
  ├─ Strong → Answer
  ├─ Low → Answer with caution / missing evidence
  └─ Insufficient → Abstain + explain + escalate
```

## 2. Product classification flow

Questions should be progressive rather than a long form.

Suggested decision sequence:

1. What is the product?
   - medicine/drug
   - food/nutritional product
   - cosmetic/personal-care
   - raw plant/biological material
   - process/device
   - brand/name only
   - unknown

2. Is the formulation based on an established/classical Ayurveda source?
   - yes
   - no
   - uncertain

3. Does it use biological resources or associated traditional knowledge?
   - yes
   - no
   - uncertain

4. Is the user asking about manufacturing/sale, IP protection, export, or a combination?

## 3. Follow-up question policy

Ask the minimum question that can change the legal route.

Bad:

> Please provide full details of ingredients, manufacturing, company type, turnover, country, dates, clinical status, and filing history.

Good:

> Is your formulation described in an authoritative classical Ayurveda source, or is it a newly developed formulation?

Then:

> Does your product use biological resources or associated traditional knowledge obtained from India?

## 4. Evidence panel flow

Every answer should support:

```text
Answer
  ├── Why this route was selected
  ├── Evidence
  │    ├── Source
  │    ├── Act / Regulation
  │    ├── Section / Rule / Article
  │    └── exact document version/date
  ├── Confidence
  ├── Missing information
  └── Next step / Escalate
```

## 5. Voice flow

```text
Mic
 ↓
Audio recording
 ↓
ASR
 ↓
Language detection / correction
 ↓
Translation to retrieval language
 ↓
Normal chat pipeline
 ↓
Answer localization
 ↓
TTS
 ↓
Playback
```

## 6. Escalation flow

```text
Low confidence
    ↓
Show "human review recommended"
    ↓
User chooses:
  - submit case
  - continue reading evidence
  - edit question
    ↓
Generate escalation package
    ↓
Store consent
    ↓
Assign case ID
```

## 7. Error flows

### No evidence

Show:

> "I could not find sufficient authoritative evidence in the current corpus to answer this reliably."

Also show:

- sources searched;
- missing information;
- whether a human expert is recommended.

### Conflicting evidence

Show:

> "The retrieved sources do not align sufficiently for a confident answer."

Then list:

- source A/version;
- source B/version;
- date/version;
- escalation CTA.

Do not silently pick one.
