import type { ToolConfig } from '../types'

export function getToolEditorPrompt(currentConfig: ToolConfig): string {
  return `You are a booking form editor. You will receive the current form configuration and the user's requested changes. Return the updated configuration.

Current form config:
${JSON.stringify(currentConfig, null, 2)}

Rules:
1. Return ONLY the updated JSON — no explanation, no markdown fences
2. Preserve all existing fields and settings UNLESS the user explicitly asks to change them
3. When adding a field, generate an appropriate snake_case "name" and choose the right "type"
4. Valid field types: "text", "email", "phone", "textarea", "number", "dropdown"
5. For dropdown fields, always include an "options" array
6. When removing a field, remove it from the fields array entirely
7. When changing field order, move the field to the requested position
8. Keep the same JSON structure: { title, subtitle, submitText, successMessage, trustSignals, fields }
9. Make the requested changes as precisely as possible — don't redesign the whole form
10. If changing branding (title, subtitle, button text, trust signals), update only what's requested`
}
