#!/usr/bin/env python3

import ast
import csv
import json
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PROTONFIXES_ROOT = ROOT / 'third_party' / 'umu-protonfixes'
OUTPUT_PATH = ROOT / 'packages' / 'dillinger-core' / 'assets' / 'generated' / 'protonfixes-index.json'

CONTROL_FLOW_NODES = (
    ast.If,
    ast.For,
    ast.While,
    ast.Try,
    ast.With,
    ast.Match,
    ast.AsyncFor,
    ast.AsyncWith,
    ast.IfExp,
)

FLAG_FUNCS = {
    'disable_nvapi',
    'disable_esync',
    'disable_fsync',
    'install_eac_runtime',
    'install_battleye_runtime',
}

OVERRIDE_MAP = {
    'NATIVE': 'native',
    'BUILTIN': 'builtin',
    'DISABLED': 'disabled',
    'NATIVE_BUILTIN': 'native,builtin',
    'BUILTIN_NATIVE': 'builtin,native',
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def sh(cmd: list[str], cwd: Path | None = None) -> str:
    return subprocess.check_output(cmd, cwd=cwd, text=True).strip()


def git_commit(repo: Path) -> str:
    try:
        return sh(['git', 'rev-parse', 'HEAD'], cwd=repo)
    except Exception:
        return 'unknown'


def is_numeric(value: str) -> bool:
    return bool(re.fullmatch(r'\d+', value))


def string_value(node: ast.AST | None) -> str | None:
    if node is None:
        return None
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def node_name(node: ast.AST | None) -> str | None:
    if node is None:
        return None
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parts: list[str] = []
        cur: ast.AST | None = node
        while isinstance(cur, ast.Attribute):
            parts.append(cur.attr)
            cur = cur.value
        if isinstance(cur, ast.Name):
            parts.append(cur.id)
        return '.'.join(reversed(parts))
    return None


def normalize_override(node: ast.AST | None) -> str | None:
    raw = node_name(node)
    if not raw:
        return None
    token = raw.split('.')[-1].upper()
    return OVERRIDE_MAP.get(token, token.lower())


def split_winetricks(raw: str) -> list[str]:
    if not raw:
        return []
    return [token for token in re.split(r'[\s,]+', raw.strip()) if token]


def parse_regedit_args(args: list[ast.AST]) -> dict | None:
    if len(args) < 4:
        return None
    path = string_value(args[0])
    name = string_value(args[1])
    reg_type = string_value(args[2])
    value = string_value(args[3])
    if not path or not name:
        return None
    return {
        'path': path,
        'name': name,
        'type': reg_type or '',
        'value': value or '',
    }


def empty_fix(script_path: str) -> dict:
    return {
        'title': '',
        'stores': [],
        'gog_ids': [],
        'winetricks': [],
        'dll_overrides': {},
        'env_vars': {},
        'del_env_vars': [],
        'command_replacements': [],
        'registry': [],
        'dxvk_options': {},
        'flags': [],
        'has_complex_logic': False,
        'script_path': script_path,
        'notes': '',
    }


def parse_python_fix(file_path: Path, script_path: str) -> dict:
    fix = empty_fix(script_path)
    source = file_path.read_text(encoding='utf-8', errors='ignore')
    tree = ast.parse(source, filename=str(file_path))

    for node in ast.walk(tree):
        if isinstance(node, CONTROL_FLOW_NODES):
            fix['has_complex_logic'] = True
        if isinstance(node, ast.Call):
            called = node_name(node.func) or ''
            if called in {'open', 'pathlib.Path.open', 'Path.open'}:
                fix['has_complex_logic'] = True

            if not isinstance(node.func, ast.Attribute):
                continue
            if not isinstance(node.func.value, ast.Name) or node.func.value.id != 'util':
                continue

            func = node.func.attr
            args = node.args

            if func == 'protontricks' and args:
                raw = string_value(args[0])
                if raw:
                    fix['winetricks'].extend(split_winetricks(raw))
            elif func == 'winedll_override' and len(args) >= 2:
                dll_name = string_value(args[0])
                order = normalize_override(args[1])
                if dll_name and order:
                    fix['dll_overrides'][dll_name] = order
            elif func == 'set_environment' and len(args) >= 2:
                key = string_value(args[0])
                value = string_value(args[1])
                if key and value is not None:
                    fix['env_vars'][key] = value
            elif func == 'del_environment' and args:
                key = string_value(args[0])
                if key:
                    fix['del_env_vars'].append(key)
            elif func == 'replace_command' and len(args) >= 2:
                original = string_value(args[0])
                replacement = string_value(args[1])
                if original and replacement:
                    fix['command_replacements'].append({'from': original, 'to': replacement})
            elif func == 'regedit_add':
                parsed = parse_regedit_args(args)
                if parsed:
                    fix['registry'].append(parsed)
            elif func == 'set_dxvk_option' and len(args) >= 2:
                key = string_value(args[0])
                value = string_value(args[1])
                if key and value is not None:
                    fix['dxvk_options'][key] = value
            elif func in FLAG_FUNCS:
                fix['flags'].append(func)

    fix['winetricks'] = sorted(set(fix['winetricks']))
    fix['del_env_vars'] = sorted(set(fix['del_env_vars']))
    fix['flags'] = sorted(set(fix['flags']))
    return fix


def key_for(store: str, codename: str) -> str:
    return f'{store}:{codename}'


def canonical_key_for_group(rows: list[dict]) -> str | None:
    for row in rows:
        if row.get('STORE') == 'steam' and row.get('CODENAME'):
            return key_for(row['STORE'], row['CODENAME'])
    first = rows[0] if rows else None
    if not first:
        return None
    if first.get('STORE') and first.get('CODENAME'):
        return key_for(first['STORE'], first['CODENAME'])
    return None


def read_umu_database(csv_path: Path) -> tuple[dict, dict]:
    entries: dict[str, dict] = {}
    by_umu_id: dict[str, list[dict]] = defaultdict(list)

    if not csv_path.exists():
        return entries, {}

    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            title = (row.get('TITLE') or '').strip()
            store = (row.get('STORE') or '').strip()
            codename = (row.get('CODENAME') or '').strip()
            umu_id = (row.get('UMU_ID') or '').strip()
            if not store or not codename:
                continue
            key = key_for(store, codename)
            entries[key] = {
                'title': title,
                'store': store,
                'codename': codename,
                'umu_id': umu_id,
            }
            if umu_id:
                by_umu_id[umu_id].append(entries[key])

    cross_refs: dict[str, str] = {}
    for rows in by_umu_id.values():
        canonical = canonical_key_for_group(rows)
        if not canonical:
            continue
        for row in rows:
            source = key_for(row['store'], row['codename'])
            if source != canonical:
                cross_refs[source] = canonical

    return entries, cross_refs


def parse_store_and_id(py_file: Path) -> tuple[str, str] | None:
    parent = py_file.parent.name
    if not parent.startswith('gamefixes-'):
        return None
    store = parent.replace('gamefixes-', '', 1)
    codename = py_file.stem
    if codename in {'__init__', 'default'}:
        return None
    return store, codename


def scan_fixes() -> tuple[dict, dict]:
    fixes: dict[str, dict] = {}
    cross_refs: dict[str, str] = {}

    for py_file in sorted(PROTONFIXES_ROOT.glob('gamefixes-*/*.py')):
        parsed = parse_store_and_id(py_file)
        if not parsed:
            continue
        store, codename = parsed
        key = key_for(store, codename)
        script_path = py_file.relative_to(PROTONFIXES_ROOT).as_posix()

        if py_file.is_symlink():
            try:
                resolved = py_file.resolve(strict=True)
                target_parsed = parse_store_and_id(resolved)
                if target_parsed:
                    target_key = key_for(target_parsed[0], target_parsed[1])
                    if target_key != key:
                        cross_refs[key] = target_key
            except Exception:
                pass

        try:
            fixes[key] = parse_python_fix(py_file, script_path)
        except SyntaxError:
            fixes[key] = empty_fix(script_path)
            fixes[key]['has_complex_logic'] = True
            fixes[key]['notes'] = 'AST parse failed; review manually.'

        if store not in fixes[key]['stores']:
            fixes[key]['stores'].append(store)

    return fixes, cross_refs


def enrich_from_database(fixes: dict, db_entries: dict, db_cross_refs: dict, file_cross_refs: dict) -> dict:
    merged_refs = {**db_cross_refs, **file_cross_refs}

    by_umu: dict[str, list[dict]] = defaultdict(list)
    for entry in db_entries.values():
        umu_id = entry.get('umu_id')
        if umu_id:
            by_umu[umu_id].append(entry)

    for key, fix in fixes.items():
        db = db_entries.get(key)
        target_key = merged_refs.get(key)
        db_target = db_entries.get(target_key) if target_key else None
        chosen = db or db_target

        if chosen:
            if not fix['title']:
                fix['title'] = chosen.get('title', '')
            umu_id = chosen.get('umu_id', '')
            related_rows = by_umu.get(umu_id, []) if umu_id else []
            if related_rows:
                stores = sorted({row.get('store', '') for row in related_rows if row.get('store')})
                fix['stores'] = stores
                fix['gog_ids'] = sorted({row.get('codename', '') for row in related_rows if row.get('store') == 'gog' and is_numeric(row.get('codename', ''))})

    # Ensure deterministic ordering
    for fix in fixes.values():
        fix['stores'] = sorted(set(fix.get('stores', [])))
        fix['gog_ids'] = sorted(set(fix.get('gog_ids', [])))

    return merged_refs


def main() -> int:
    if not PROTONFIXES_ROOT.exists():
        raise SystemExit(f'Protonfixes submodule not found: {PROTONFIXES_ROOT}')

    fixes, file_cross_refs = scan_fixes()
    db_entries, db_cross_refs = read_umu_database(PROTONFIXES_ROOT / 'umu-database.csv')
    merged_cross_refs = enrich_from_database(fixes, db_entries, db_cross_refs, file_cross_refs)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        'generated_at': now_iso(),
        'commit': git_commit(PROTONFIXES_ROOT),
        'fixes': {k: fixes[k] for k in sorted(fixes.keys())},
        'cross_references': {k: merged_cross_refs[k] for k in sorted(merged_cross_refs.keys())},
        'umu_database': {k: db_entries[k] for k in sorted(db_entries.keys())},
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, sort_keys=False) + '\n', encoding='utf-8')
    print(f'Indexed {len(fixes)} fixes to {OUTPUT_PATH}')
    print(f'Cross references: {len(merged_cross_refs)}')
    print(f'UMU database rows: {len(db_entries)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
