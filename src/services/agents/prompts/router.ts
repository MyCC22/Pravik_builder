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
- "change_image": User wants to change, replace, or swap an image/photo on the site
- "edit_tool": User wants to modify the booking/lead capture form (fields, branding, button text)
- "add_tool": User wants to add a booking form or lead capture form to their site
- "generate_site": User wants to completely rebuild the site from scratch
- "clone_site": User provides a URL and wants to clone/recreate/copy that website
- "clarify": The request is too ambiguous to act on — ask a question`
    : `
Available intents:
- "generate_site": User describes what they want and we build it
- "clone_site": User provides a URL and wants to clone/recreate/copy that website
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
  "description": "what you understood the user wants — for change_image this is used as the image search query",
  "question": "only if intent is clarify, the question to ask",
  "position": number (only for add_block — where to insert, 0-indexed),
  "clone_url": "URL string (only for clone_site)",
  "clone_mode": "content" | "content_and_style" (only for clone_site),
  "image_placement": "replace" | "background" (only for change_image — see below)
}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- For edit_block: target_blocks should contain the block type(s) to edit
- For add_block: target_blocks should contain the new block type, position should be where to insert it
- For remove_block: target_blocks should contain the block type(s) to remove
- For change_theme: target_blocks can be empty
- For change_image: target_blocks should be the block type containing the image
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
- "connect button to booking", "link CTA to booking form", "make the button go to booking", "wire button to form" → edit_block on the hero or cta block (this changes the HTML href, not the tool config)
- "button doesn't work", "CTA link is broken", "button goes to wrong place" → edit_block on the hero or cta block
- When the user wants to change WHERE a button links to, that's always edit_block (changing HTML), not edit_tool

change_image rules:
- If user says "[User attached N image(s)]" at the end of their message, they have uploaded images. Use change_image intent.
- target_blocks: the block with the image (usually "hero" or "gallery"). If not specified, default to "hero".
- description: what kind of image the user wants (used as the search query for finding images). If the user attached images, set description to "user_provided".
- If user says "change the image" with no attachment and no description, set description to "ask_user".
- image_placement: determines HOW the image is placed in the section:
  - "replace" (default): swap the image URL in-place, keep current layout
  - "background": use as a full-width background image covering the entire section (e.g. "background image", "behind the text", "cover the section", "full width background", "make it the background")
  Use your natural language understanding here — if the user is asking for the image to be the background of a section, set "background". Otherwise set "replace".

clone_site rules:
- User provides a URL and wants to clone/recreate/copy that website
- Put the URL in "clone_url" field
- clone_mode: "content_and_style" if user mentions matching the style/look/design, "content" otherwise`
}
