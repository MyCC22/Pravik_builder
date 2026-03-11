import type { Block } from '../types'

const BLOCK_TYPES = ['navbar', 'hero', 'features', 'gallery', 'pricing', 'cta', 'contact', 'footer', 'testimonials', 'custom']
const THEMES = ['clean', 'bold', 'vibrant', 'warm']

export function getRouterPrompt(blocks: Block[], currentTheme: string | null): string {
  const hasBlocks = blocks.length > 0
  const blockSummary = blocks.map(b => `${b.block_type}:${b.position}`).join(', ')

  const availableIntents = hasBlocks
    ? `
Available intents:
- "edit_block": User wants to change content, style, or layout of an existing block
- "add_block": User wants to add a new section to the site
- "remove_block": User wants to delete a section
- "reorder_blocks": User wants to move sections around
- "change_theme": User wants to change colors or theme
- "edit_tool": User wants to modify the booking/lead capture form (fields, branding, button text)
- "add_tool": User wants to add a booking form or lead capture form to their site
- "generate_site": User wants to completely rebuild the site from scratch
- "clarify": The request is too ambiguous to act on — ask a question`
    : `
Available intents:
- "generate_site": User describes what they want and we build it
- "clarify": The request is too vague to build a site — ask what kind of site they need`

  return `You are an intent classifier for a website builder. Analyze the user's message and determine what action to take.

Current site state:
- Has blocks: ${hasBlocks}
${hasBlocks ? `- Current blocks: [${blockSummary}]` : '- No blocks yet (empty site)'}
- Current theme: ${currentTheme || 'none'}

${availableIntents}

Block types: ${BLOCK_TYPES.join(', ')}
Themes: ${THEMES.join(', ')}

Return a JSON object:
{
  "intent": "intent_name",
  "target_blocks": ["block_type"],
  "description": "what you understood the user wants",
  "question": "only if intent is clarify, the question to ask",
  "position": number (only for add_block — where to insert, 0-indexed)
}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- For edit_block: target_blocks should contain the block type(s) to edit
- For add_block: target_blocks should contain the new block type, position should be where to insert it
- For remove_block: target_blocks should contain the block type(s) to remove
- For change_theme: target_blocks can be empty
- For generate_site: target_blocks can be empty
- For edit_tool and add_tool: target_blocks can be empty
- When the user mentions "top" or "header", that's usually the navbar
- When the user mentions "bottom" or "end", that's usually the footer
- "Colors", "darker", "lighter", "warmer" → change_theme
- "Add phone number" or "change text" on an existing section → edit_block
- "Add a testimonials section" → add_block
- "form", "booking form", "fields", "dropdown", "add a field", "change the form", "make required", "update the form" → edit_tool
- "add a booking form", "add a contact form", "add lead capture" → add_tool
- "add a contact section", "add a features section" → add_block (HTML section, NOT a tool)
- Key distinction: form-specific language (fields, dropdown, required, form fields) → tool intents. Section-specific language (section, block) → block intents.
- If unsure which block the user means, use clarify`
}
