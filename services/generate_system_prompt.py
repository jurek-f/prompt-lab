#!/usr/bin/env python3
"""
Generate a system prompt from example query → answer pairs.

Usage:
  python services/generate_system_prompt.py <suite.json>  [output_name]
      Derive a prompt from all examples in a test_cases.json file.

  python services/generate_system_prompt.py <query> <answer>  [output_name]
      Derive a prompt from a single query + gold answer string.

Writes to  app/public/data/system_prompts/<output_name>.txt  (auto-named if omitted).
Requires:  ANTHROPIC_API_KEY environment variable.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

REPO_ROOT  = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT_DIR = os.path.join(REPO_ROOT, 'data', 'system_prompts')
MODEL      = 'claude-sonnet-4-6'

META_SYSTEM = """\
You are a prompt engineer.

Task: given examples of ideal query → answer pairs, write a concise, complete system prompt \
that would reliably produce outputs of that quality.

Rules for the system prompt you write:
- Be self-contained — no references to "these examples" or "the above"
- Focus on the criteria that distinguish these ideal outputs from mediocre ones
- Do not prescribe an output format unless the examples clearly follow one

Return ONLY the system prompt text — no preamble, no explanation, no markdown wrapper.\
"""

MAX_EXAMPLES = 8

# ── API ───────────────────────────────────────────────────────────────────────

def _api(messages, system=None, max_tokens=2048):
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        sys.exit('Error: ANTHROPIC_API_KEY environment variable not set')
    payload = {'model': MODEL, 'max_tokens': max_tokens, 'messages': messages}
    if system:
        payload['system'] = system
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=json.dumps(payload).encode(),
        headers={
            'x-api-key':         key,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())['content'][0]['text']
    except urllib.error.HTTPError as e:
        sys.exit(f'API error {e.code}: {e.read().decode()}')

# ── formatting ────────────────────────────────────────────────────────────────

def format_examples(cases):
    lines = []
    for i, c in enumerate(cases[:MAX_EXAMPLES], 1):
        lines.append(f'=== Example {i} ===')
        lines.append(f'Query: {c["query"]}')
        lines.append(f'Ideal answer:\n{c["targetAnswer"]}')
        lines.append('')
    if len(cases) > MAX_EXAMPLES:
        lines.append(f'(+ {len(cases) - MAX_EXAMPLES} further examples omitted for brevity)')
    return '\n'.join(lines)

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        sys.exit(0)

    source = argv[0]

    if source.endswith('.json') and os.path.exists(source):
        with open(source, encoding='utf-8') as f:
            cases = json.load(f)
        label       = os.path.splitext(os.path.basename(source))[0]
        output_name = argv[1] if len(argv) > 1 else None
        print(f'Using {min(len(cases), MAX_EXAMPLES)} of {len(cases)} examples from {source}')
    else:
        if len(argv) < 2:
            sys.exit('Provide either a .json suite file or: <query> <answer> [output_name]')
        cases       = [{'query': source, 'targetAnswer': argv[1]}]
        label       = re.sub(r'[^a-z0-9]+', '_', source.lower())[:30].strip('_')
        output_name = argv[2] if len(argv) > 2 else None
        print(f'Using single example: "{source}"')

    examples_text = format_examples(cases)
    user_msg = (
        f'Here are examples of ideal query → answer pairs:\n\n'
        f'{examples_text}\n'
        f'Write the system prompt.'
    )

    print('Generating system prompt…')
    prompt_text = _api([{'role': 'user', 'content': user_msg}], system=META_SYSTEM)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if output_name:
        fname = output_name if output_name.endswith('.txt') else f'{output_name}.txt'
    else:
        ts    = time.strftime('%Y%m%d_%H%M%S')
        fname = f'{ts}_{label}.txt'

    path = os.path.join(OUTPUT_DIR, fname)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(prompt_text.strip() + '\n')

    words = len(prompt_text.split())
    chars = len(prompt_text)
    print(f'✓  {words} words / {chars} chars → {os.path.relpath(path)}')


if __name__ == '__main__':
    main()
