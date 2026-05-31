#!/usr/bin/env python3
"""
Generate test cases for prompt optimization.

Usage:
  python services/generate_test_cases.py
      10 random query-answer pairs

  python services/generate_test_cases.py 5
      5 random query-answer pairs

  python services/generate_test_cases.py 10 "photosynthesis"
      seed query + 9 similar queries, each with a generated answer

  python services/generate_test_cases.py 10 "photosynthesis" "Answer text" biology_batch
      seed query with provided answer + 9 similar → biology_batch.json

Positional arguments (all optional):
  count            Number of test cases (default: 10)
  query            Seed query or topic (any text)
  target_answer    Gold answer as plain text
  output_filename  Output file name without .json extension

Reads system prompt from  app/public/data/system_prompts/active.txt (falls back to built-in).
Writes output to          app/public/data/regression_tests/
Requires: ANTHROPIC_API_KEY environment variable.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

REPO_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT_DIR  = os.path.join(REPO_ROOT, 'data', 'regression_tests')
PROMPT_FILE = os.path.join(REPO_ROOT, 'data', 'system_prompts', 'active.txt')
MODEL       = 'claude-sonnet-4-6'

FALLBACK_SYSTEM = 'You are a helpful assistant. Answer the user query concisely and accurately.'

# ── API ───────────────────────────────────────────────────────────────────────

def _api(messages, system=None, max_tokens=4096):
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

# ── helpers ───────────────────────────────────────────────────────────────────

def load_system_prompt():
    if os.path.exists(PROMPT_FILE):
        with open(PROMPT_FILE, encoding='utf-8') as f:
            return f.read().strip()
    print(f'Warning: {PROMPT_FILE} not found — using fallback prompt', file=sys.stderr)
    return FALLBACK_SYSTEM


def gen_queries_similar(seed, n):
    text = _api([{'role': 'user', 'content': (
        f'Generate {n} queries similar in domain and style to:\n'
        f'"{seed}"\n\n'
        '- Each must be a short topic or phrase (under 80 characters)\n'
        '- Cover distinct sub-topics or adjacent concepts — not the same topic\n'
        '- Return ONLY a JSON array of strings, nothing else:\n'
        '["query 1", "query 2", ...]'
    )}])
    m = re.search(r'\[[\s\S]*?\]', text)
    if not m:
        sys.exit(f'Could not parse query list from response:\n{text}')
    return json.loads(m.group(0))


def gen_queries_random(n):
    text = _api([{'role': 'user', 'content': (
        f'Generate {n} diverse queries covering different domains.\n'
        'Each must be a short topic or phrase (under 80 characters).\n'
        'Spread across: science, history, language, philosophy, economics, psychology, technology, etc.\n'
        'Return ONLY a JSON array of strings, nothing else:\n'
        '["query 1", "query 2", ...]'
    )}])
    m = re.search(r'\[[\s\S]*?\]', text)
    if not m:
        sys.exit(f'Could not parse query list from response:\n{text}')
    return json.loads(m.group(0))


def gen_answer(query, system_prompt):
    return _api(
        messages=[{'role': 'user', 'content': query}],
        system=system_prompt,
    )


def make_tc(label, query, target_answer):
    return {
        'label':         label,
        'query':         query,
        'targetAnswer':  target_answer,
        'passThreshold': 0.7,
        'id':            f'tc_{int(time.time() * 1000)}',
    }

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    argv = sys.argv[1:]

    count       = int(argv[0]) if len(argv) > 0 else 10
    query       = argv[1]      if len(argv) > 1 else None
    target_raw  = argv[2]      if len(argv) > 2 else None
    output_name = argv[3]      if len(argv) > 3 else None

    system_prompt = load_system_prompt()
    cases = []

    if query is None:
        print(f'Generating {count} random queries…')
        queries = gen_queries_random(count)
        for q in queries:
            print(f'  answer ← {q}')
            cases.append(make_tc(q, q, gen_answer(q, system_prompt)))
            time.sleep(0.3)

    elif target_raw is not None:
        cases.append(make_tc(query, query, target_raw))

        if count > 1:
            print(f'Generating {count - 1} queries similar to "{query}"…')
            for q in gen_queries_similar(query, count - 1):
                print(f'  answer ← {q}')
                cases.append(make_tc(q, q, gen_answer(q, system_prompt)))
                time.sleep(0.3)

    else:
        print(f'Generating answer for "{query}"…')
        cases.append(make_tc(query, query, gen_answer(query, system_prompt)))
        time.sleep(0.3)

        if count > 1:
            print(f'Generating {count - 1} similar queries…')
            for q in gen_queries_similar(query, count - 1):
                print(f'  answer ← {q}')
                cases.append(make_tc(q, q, gen_answer(q, system_prompt)))
                time.sleep(0.3)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if output_name:
        fname = output_name if output_name.endswith('.json') else f'{output_name}.json'
    else:
        ts   = time.strftime('%Y%m%d_%H%M%S')
        slug = re.sub(r'[^a-z0-9]+', '_', (query or 'random').lower())[:25].strip('_')
        fname = f'{ts}_{slug}.json'

    path = os.path.join(OUTPUT_DIR, fname)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cases, f, ensure_ascii=False, indent=2)

    print(f'\n✓  {len(cases)} test cases → {os.path.relpath(path)}')
    for c in cases:
        print(f'   {c["id"]}  {c["label"]}')


if __name__ == '__main__':
    main()
