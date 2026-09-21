# Multilingual and Voice Architecture

## 1. Goal

Support Indian-language interaction without contaminating the legal retrieval layer with unstable translation or script changes.

Internal canonical language for MVP:

```text
English
```

User interaction may be in:

- Hindi
- Gujarati
- Marathi
- Bengali
- Tamil
- Telugu
- Kannada
- Malayalam
- Odia
- Punjabi
- other supported languages based on the active BHASHINI model catalog
```

## 2. Text flow

```text
User text
  ↓
language detection
  ↓
store original text
  ↓
translate to internal retrieval language
  ↓
retrieve English legal corpus
  ↓
generate grounded answer
  ↓
translate answer to user language
  ↓
show answer + unchanged citations
```

## 3. Voice flow

```text
audio
 ↓
ASR
 ↓
language detection / normalization
 ↓
translation
 ↓
RAG
 ↓
answer
 ↓
translation
 ↓
TTS
```

## 4. BHASHINI integration

The current BHASHINI developer documentation exposes a pipeline model for:

- ASR
- translation
- TTS
- language detection
- transliteration

The documented inference interface uses pipeline tasks and service IDs. Keep BHASHINI behind an adapter so the application does not depend on provider-specific payloads outside the adapter.

Adapter interface:

```python
class LanguageProvider(Protocol):
    def detect_text_language(self, text: str) -> LanguageResult: ...
    def speech_to_text(self, audio: bytes, language: str) -> ASRResult: ...
    def translate(self, text: str, source: str, target: str) -> TranslationResult: ...
    def text_to_speech(self, text: str, language: str) -> TTSResult: ...
```

## 5. Translation invariants

Do not translate:

- section numbers;
- act titles in citations;
- legal identifiers;
- registry application numbers;
- URLs.

Legal names can have:

```text
display_translation
canonical_name
```

## 6. Glossary

Maintain a protected terminology dictionary:

```yaml
"patent": "patent"
"geographical indication": "GI"
"access and benefit sharing": "ABS"
"traditional knowledge": "TK"
"patent and proprietary medicine": "PPM"
```

Use glossary-aware translation where available.

## 7. Voice privacy

Audio should be:

- processed only as needed;
- deleted after retention window;
- excluded from permanent logs unless explicitly needed and consented;
- stored separately from answer text if retained.

## 8. Failure fallback

If language service fails:

```text
show original transcription if available
or ask user to type
or provide supported-language fallback
```

Do not silently answer in a different language.
