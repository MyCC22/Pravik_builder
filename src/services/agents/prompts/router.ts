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
  "description": "what you understood the user wants",
  "question": "only if intent is clarify, the question to ask",
  "position": number (only for add_block — where to insert, 0-indexed),
  "clone_url": "URL string (only for clone_site)",
  "clone_mode": "content" | "content_and_style" (only for clone_site)
}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- For edit_block: target_blocks should contain the block type(s) to edit
- For add_block: target_blocks should contain the new block type, position should be where to insert it
- For remove_block: target_blocks should contain the block type(s) to remove
- For change_theme: target_blocks can be empty
- For change_image: target_blocks should be the block type containing the image, description should be the desired image search term
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
- "change image", "different photo", "I don't like the image", "swap the picture", "new background image", "replace the photo" → change_image
- For change_image: target_blocks should be the block with the image (usually "hero" or "gallery"). Put what kind of image the user wants in "description" (this is used as the image search query).
- If the user says "change the hero image" with no other description, use the site's business type as the description
- If unsure which block the user means, use clarify
- User provides a URL (http/https/www) and says "clone", "copy", "recreate", "rebuild", "make me a site like", "replicate", "base it on" -> clone_site
- For clone_site: put the URL in "clone_url" field, and add "clone_mode" field:
  - "content_and_style" if user mentions style: "match the style", "same look", "similar design", "look and feel", "same vibe"
  - "content" otherwise (default)
- "clone example.com" -> clone_site with clone_url="https://example.com", clone_mode="content"
- "recreate example.com and match the style" -> clone_site with clone_url="https://example.com", clone_mode="content_and_style"`
}
