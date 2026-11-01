#!/usr/bin/env node
/*
 *  ThunderAI — thinking-model demo
 *
 *  Streams a prompt to an OpenAI-compatible server (e.g. your Unsloth/Qwen
 *  server) using the SAME logic ThunderAI's openai_comp worker uses, and shows
 *  the reasoning separated from the answer in real time. Reuses the add-on's
 *  real ReasoningSplitter so it faithfully demonstrates the shipped behaviour.
 *
 *  Usage:
 *    node demo/thinking-demo.mjs --host http://localhost:11434 --model qwen3:8b \
 *        [--key sk-...] [--no-v1] [--prompt "Explain why the sky is blue."]
 *
 *  Env fallbacks: THUNDERAI_HOST, THUNDERAI_MODEL, THUNDERAI_KEY
 */

import { ReasoningSplitter } from '../js/api/reasoning-splitter.js';

// ---- tiny arg parser -------------------------------------------------------
const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const hasFlag = (name) => args.includes('--' + name);

const host = (opt('host', process.env.THUNDERAI_HOST) || '').replace(/\/+$/, '');
const model = opt('model', process.env.THUNDERAI_MODEL);
const apiKey = opt('key', process.env.THUNDERAI_KEY || '');
const useV1 = !hasFlag('no-v1');
const prompt = opt('prompt', 'In two short sentences, is it safe to click a link in an email from "support@paypa1.com"? Think it through first.');

if (!host || !model) {
  console.error('Usage: node demo/thinking-demo.mjs --host <url> --model <name> [--key <k>] [--no-v1] [--prompt "..."]');
  console.error('   or set THUNDERAI_HOST / THUNDERAI_MODEL / THUNDERAI_KEY');
  process.exit(1);
}

// ---- ANSI colours ----------------------------------------------------------
const dim = (s) => `\x1b[2;3m${s}\x1b[0m`;     // dim italic — thinking
const grn = (s) => `\x1b[32m${s}\x1b[0m`;      // green — answer
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const url = host + (useV1 ? '/v1' : '') + '/chat/completions';
console.log(bold('\nThunderAI thinking demo'));
console.log(`  endpoint : ${url}`);
console.log(`  model    : ${model}`);
console.log(`  prompt   : ${prompt}\n`);
console.log(bold('── streaming ──') + '  ' + dim('(dim italic = thinking)') + '  ' + grn('(green = answer)') + '\n');

const headers = { 'Content-Type': 'application/json' };
if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

const res = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: true }),
});

if (!res.ok) {
  console.error(`\nHTTP ${res.status} ${res.statusText}\n` + (await res.text()).slice(0, 500));
  process.exit(1);
}

const splitter = new ReasoningSplitter();
let answer = '';
let reasoning = '';

const reader = res.body.getReader();
const decoder = new TextDecoder('utf-8');
let buffer = '';

function emit(reasoningDelta, answerDelta) {
  if (reasoningDelta) { reasoning += reasoningDelta; process.stdout.write(dim(reasoningDelta)); }
  if (answerDelta)    { answer += answerDelta;       process.stdout.write(grn(answerDelta)); }
}

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const raw of lines) {
    const line = raw.replace(/^data: /, '').trim();
    if (!line || line === '[DONE]') continue;
    let parsed;
    try { parsed = JSON.parse(line); } catch { continue; }
    const delta = parsed.choices?.[0]?.delta;
    if (!delta) continue;
    // 1) reasoning delivered as a separate field (vLLM/SGLang/newer llama.cpp)
    const reasoningField = delta.reasoning_content ?? delta.reasoning;
    if (reasoningField) emit(reasoningField, '');
    // 2) reasoning delivered inline as <think>...</think> in content
    if (delta.content) {
      const { answer: a, reasoning: r } = splitter.push(delta.content);
      emit(r, a);
    }
  }
}
const flushed = splitter.flush();
emit(flushed.reasoning, flushed.answer);

// ---- summary ---------------------------------------------------------------
console.log(bold('\n\n── result (what ThunderAI separates) ──'));
console.log(`  thinking : ${reasoning.length} chars  ${reasoning.length ? '(shown in collapsible box, NOT inserted)' : '(none detected)'}`);
console.log(`  answer   : ${answer.length} chars  (this is what gets inserted into the email)\n`);
console.log(bold('Clean answer:'));
console.log(answer.trim() + '\n');
