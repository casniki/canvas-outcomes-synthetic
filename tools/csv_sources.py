"""Point every imported table of the synthetic semantic model at data/*.csv.

For each table whose partition is an M query over the old warehouse, the
partition source is replaced by a CSV read of data/<table>.csv, typed from the
column's own TMDL dataType so names and types stay identical. The Server and
Database parameters are removed and a DataFolder parameter is added. Tables
without a warehouse source (Date, Program Code Map) are left as they are.

Usage:  python -I tools/csv_sources.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEF = os.path.join(ROOT, 'canvas-outcomes-synthetic.SemanticModel', 'definition')
DATA_FOLDER = os.path.join(ROOT, 'data') + '\\'

M_TYPE = {'int64': 'Int64.Type', 'decimal': 'Currency.Type', 'double': 'type number',
          'dateTime': 'type datetime', 'boolean': 'type logical', 'string': 'type text'}
KEEP = {'Date', 'Program Code Map'}


def csv_name(table):
    return table.lower().replace(' ', '_') + '.csv'


def columns(text):
    """(sourceColumn, dataType) for every data column in a table file."""
    out = []
    for block in re.split(r'\n\t(?=column |measure |partition |hierarchy |annotation )', text):
        if not block.startswith('column '):
            continue
        dtype = re.search(r'\n\t\tdataType: (\S+)', block)
        src = re.search(r'\n\t\tsourceColumn: (.+)', block)
        if dtype and src:
            out.append((src.group(1).strip(), dtype.group(1)))
    return out


def m_source(table, cols):
    types = ', '.join('{"%s", %s}' % (c, M_TYPE[t]) for c, t in cols)
    lines = [
        'let',
        f'    Source = Csv.Document(File.Contents(DataFolder & "{csv_name(table)}"), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),',
        '    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),',
        '    // Empty CSV fields are nulls',
        '    Nulls = Table.ReplaceValue(Promoted, "", null, Replacer.ReplaceValue, Table.ColumnNames(Promoted)),',
        f'    Typed = Table.TransformColumnTypes(Nulls, {{{types}}}, "en-US")',
        'in',
        '    Typed',
    ]
    return ''.join('\t\t\t\t' + l + '\n' for l in lines)


def rewrite_table(path):
    with open(path, encoding='utf-8') as f:
        text = f.read()
    m = re.search(r"^table (.+)$", text, re.M)
    table = m.group(1).strip().strip("'")
    if table in KEEP:
        return None
    start = text.index('\t\tsource =\n', text.index('\tpartition ')) + len('\t\tsource =\n')
    end = start
    lines = text[start:].split('\n')
    n = 0
    for line in lines:
        if line.startswith('\t\t\t\t') or line.strip() == '':
            n += 1
        else:
            break
    while n and lines[n - 1].strip() == '':   # keep the blank line(s) that follow the block
        n -= 1
    end = start + sum(len(l) + 1 for l in lines[:n])
    new = text[:start] + m_source(table, columns(text)) + text[end:]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new)
    return table


def rewrite_expressions():
    p = os.path.join(DEF, 'expressions.tmdl')
    with open(p, encoding='utf-8') as f:
        text = f.read()
    # Split into blocks: each expression line plus the /// doc lines just above it.
    blocks, doc, cur = [], [], None
    for line in text.split('\n'):
        if line.startswith('///'):
            doc.append(line)
        elif line.startswith('expression '):
            cur = doc + [line]
            blocks.append(cur)
            doc = []
        elif cur is not None:
            cur.append(line)
    drop = re.compile(r'^expression (Server|Database|DataFolder) =')
    kept = ['\n'.join(b).rstrip('\n') + '\n\n' for b in blocks if not drop.match(next(l for l in b if l.startswith('expression ')))]
    param = ('/// Folder holding the synthetic CSV extract (data\\ in this project). Change it if the project moves.\n'
             f'expression DataFolder = "{DATA_FOLDER}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n'
             '\tlineageTag: 5b0f8f0e-5c1e-4a43-9f43-1d7a2c9e6a10\n\n'
             '\tannotation PBI_ResultType = Text\n\n')
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write((param + ''.join(kept)).rstrip('\n') + '\n')


def rewrite_query_order():
    p = os.path.join(DEF, 'model.tmdl')
    with open(p, encoding='utf-8') as f:
        text = f.read()
    text = text.replace('"Server","Database",', '"DataFolder",')
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


if __name__ == '__main__':
    done = [t for t in (rewrite_table(os.path.join(DEF, 'tables', f)) for f in sorted(os.listdir(os.path.join(DEF, 'tables')))) if t]
    rewrite_expressions()
    rewrite_query_order()
    print('CSV sources:', ', '.join(done))
