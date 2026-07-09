# Prompts

> Central catalog of AI prompt templates used across the app. Keep runtime prompt
> builders in `src/lib/ai/` and mirror/document them here so they're reviewable.

## Guidelines

- Prefer **structured, versioned** prompt templates over inline strings.
- Parameterize inputs; never string-concatenate untrusted user input without
  clear delimiters.
- Note the target provider/model for each prompt (behavior varies).
- When changing a prompt meaningfully, bump its version and note it in
  [CHANGELOG.md](./CHANGELOG.md).

## Template format

```
### <prompt-name> (v1)
- Provider/model: <e.g. Claude / latest>
- Purpose: <what it does>
- Inputs: <variables>

System:
<system prompt>

User:
<user template with {{variables}}>
```

## Catalog

### _example-prompt_ (v1)
- Provider/model: _TBD_
- Purpose: _TBD_
- Inputs: `{{input}}`

System:
```
You are ...
```

User:
```
{{input}}
```

## Related

- [AI_PROVIDERS.md](./AI_PROVIDERS.md)
