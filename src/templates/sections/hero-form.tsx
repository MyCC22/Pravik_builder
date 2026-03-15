import type { ThemeClasses } from '../theme-classes'
import type { ToolField } from '../../services/agents/types'
import { escapeHtml } from '../utils'

const ALLOWED_FIELD_TYPES = ['text', 'email', 'phone', 'dropdown'] as const

/**
 * Renders an overlapping registration form card for the hero section.
 * Returns raw HTML string + inline <script> for submission handling.
 * Returns empty string if toolId is falsy (hero renders without form).
 */
export function renderHeroForm(
  toolId: string,
  fields: ToolField[],
  t: ThemeClasses,
  submitText = 'Get Started',
  successMessage = 'Thanks! We will be in touch soon.',
  formTitle?: string
): string {
  if (!toolId) return ''

  // Guardrails: filter to allowed types, cap at 4 fields
  let safeFields = fields
    .filter(f => (ALLOWED_FIELD_TYPES as readonly string[]).includes(f.type))
    .slice(0, 4)

  // Ensure name + email exist
  const hasName = safeFields.some(f => f.type === 'text' && f.name === 'name')
  const hasEmail = safeFields.some(f => f.type === 'email')
  if (!hasEmail) {
    safeFields.unshift({ name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Your email' })
  }
  if (!hasName) {
    safeFields.unshift({ name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your name' })
  }
  safeFields = safeFields.slice(0, 4)

  const titleHtml = formTitle
    ? `<h3 class="text-lg font-bold ${t.formLabelText} mb-4 text-center">${escapeHtml(formTitle)}</h3>`
    : ''

  const fieldsHtml = safeFields.map(f => renderField(f, t)).join('\n')

  const formId = `hero-form-${toolId.slice(0, 8)}`

  return `
<div class="relative z-10 max-w-xl mx-auto px-4 -mt-16">
  <div id="${formId}" class="${t.formCardBg} rounded-2xl ${t.cardShadow} p-6 sm:p-8 border ${t.formInputBorder}">
    ${titleHtml}
    <form id="${formId}-form" onsubmit="return false;" novalidate>
      <div class="space-y-4">
        ${fieldsHtml}
      </div>
      <button
        type="submit"
        id="${formId}-btn"
        class="${t.accentBg} ${t.accentBgHover} ${t.accentText} w-full mt-6 px-8 py-3.5 text-base font-semibold rounded-full shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        <span id="${formId}-btn-text">${escapeHtml(submitText)}</span>
        <span id="${formId}-spinner" class="hidden w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      </button>
      <div id="${formId}-error" class="hidden mt-3 text-sm text-red-600 text-center"></div>
    </form>
    <div id="${formId}-success" class="hidden text-center py-6">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
        <svg class="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <p class="text-lg font-semibold ${t.formLabelText}">${escapeHtml(successMessage)}</p>
    </div>
  </div>
</div>
${renderInlineScript(formId, toolId, safeFields)}
`
}

function renderField(field: ToolField, t: ThemeClasses): string {
  const id = `hf-${field.name}`
  const req = field.required ? ' required' : ''
  const ph = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''
  const label = `<label for="${id}" class="block text-sm font-medium ${t.formLabelText} mb-1">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`
  const inputClasses = `w-full px-4 py-2.5 ${t.formInputBg} ${t.formInputText} border ${t.formInputBorder} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition`
  const errorDiv = `<div id="${id}-err" class="hidden text-xs text-red-600 mt-1"></div>`

  if (field.type === 'dropdown' && field.options?.length) {
    const opts = field.options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')
    return `<div>${label}<select id="${id}" name="${field.name}" class="${inputClasses}"${req}><option value="">Select...</option>${opts}</select>${errorDiv}</div>`
  }

  const typeMap: Record<string, string> = { text: 'text', email: 'email', phone: 'tel' }
  const inputType = typeMap[field.type] || 'text'

  return `<div>${label}<input id="${id}" name="${field.name}" type="${inputType}" class="${inputClasses}"${ph}${req}/>${errorDiv}</div>`
}

function renderInlineScript(formId: string, toolId: string, fields: ToolField[]): string {
  const fieldMeta = JSON.stringify(fields.map(f => ({
    name: f.name,
    type: f.type,
    required: f.required,
  })))

  return `<script>
(function(){
  var formEl=document.getElementById('${formId}-form');
  var btn=document.getElementById('${formId}-btn');
  var btnText=document.getElementById('${formId}-btn-text');
  var spinner=document.getElementById('${formId}-spinner');
  var errBox=document.getElementById('${formId}-error');
  var successBox=document.getElementById('${formId}-success');
  var fields=${fieldMeta};
  var submitting=false;

  function strip(s){return s.replace(/<[^>]*>/g,'').trim();}

  function validate(){
    var ok=true;
    fields.forEach(function(f){
      var el=document.getElementById('hf-'+f.name);
      var errEl=document.getElementById('hf-'+f.name+'-err');
      if(!el||!errEl)return;
      var v=strip(el.value);
      errEl.classList.add('hidden');errEl.textContent='';
      if(f.required&&!v){errEl.textContent='Required';errEl.classList.remove('hidden');ok=false;}
      else if(f.type==='email'&&v&&!/.+@.+\\..+/.test(v)){errEl.textContent='Invalid email';errEl.classList.remove('hidden');ok=false;}
      else if(f.type==='phone'&&v&&(v.replace(/\\D/g,'')).length<7){errEl.textContent='Invalid phone';errEl.classList.remove('hidden');ok=false;}
    });
    return ok;
  }

  btn.addEventListener('click',function(){
    if(submitting)return;
    errBox.classList.add('hidden');
    if(!validate())return;
    submitting=true;
    btnText.classList.add('hidden');spinner.classList.remove('hidden');
    btn.disabled=true;

    var data={};
    fields.forEach(function(f){
      var el=document.getElementById('hf-'+f.name);
      if(el)data[f.name]=strip(el.value);
    });

    fetch('/api/tools/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({tool_id:'${toolId}',data:data})
    }).then(function(r){
      if(r.ok){
        formEl.style.transition='opacity 0.3s';formEl.style.opacity='0';
        setTimeout(function(){
          formEl.classList.add('hidden');
          successBox.classList.remove('hidden');
          successBox.style.opacity='0';
          setTimeout(function(){successBox.style.transition='opacity 0.3s';successBox.style.opacity='1';},10);
        },300);
      } else if(r.status===429){
        errBox.textContent='Please wait a moment before trying again.';errBox.classList.remove('hidden');
        submitting=false;btnText.classList.remove('hidden');spinner.classList.add('hidden');btn.disabled=false;
      } else {
        errBox.textContent='Something went wrong. Please try again.';errBox.classList.remove('hidden');
        submitting=false;btnText.classList.remove('hidden');spinner.classList.add('hidden');btn.disabled=false;
      }
    }).catch(function(){
      errBox.textContent='Something went wrong. Please try again.';errBox.classList.remove('hidden');
      submitting=false;btnText.classList.remove('hidden');spinner.classList.add('hidden');btn.disabled=false;
    });
  });
})();
</script>`
}
