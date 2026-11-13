"""Generate the synthetic Canvas Data 2 extract for canvas-outcomes-synthetic.

Reads ONLY the institutional metadata written by tools/extract_metadata.ps1:
  metadata/orgs.csv              School, Department, Account Name, Account Path
  metadata/outcomes.csv          outcome titles, types, groups, programs, owning account
  metadata/groups.csv            outcome group names/paths (course roots = {COURSE})
  metadata/program_code_map.csv  Program Code Map
Nothing here reads or copies a user, enrollment, course name, instructor or
outcome-result row. Every student, course, enrollment, assignment, rubric and
result below is invented. Fixed seed, so reruns produce identical files.

Writes data/*.csv, one per model table, with the model's sourceColumn names as
headers, so the CSV partitions keep every column name and type unchanged.

Usage:  python -I tools/make_synthetic.py
"""
import csv
import datetime as dt
import math
import os
import random
from collections import Counter, defaultdict

SEED = 20261113
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, 'metadata')
DATA = os.path.join(ROOT, 'data')

N_STUDENTS = 3000
N_COURSES = 400
N_TEST_COURSES = 5
START = dt.date(2022, 7, 1)
END = dt.date(2026, 10, 31)

# Result volume by outcome type (core values are fixed at 1,500).
TARGET = {'PLO': 24000, 'Institutional Outcome': 16000, 'Course Outcome': 15000,
          'Accreditation Standard': 3500}
N_CORE = 1500
N_WATCHLIST = 3
CLOSED_PROGRAMS = {'Orthotics and Prosthetics — M.S.'}   # closed: no results

NON_PROGRAM = {'Communities', 'Development Shells', 'Migrated Courses', 'Course Developer',
               'Backups', 'Archive', 'Exams', 'Templates'}

rng = random.Random(SEED)


def read(name):
    with open(os.path.join(META, name), encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def write(name, header, rows):
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, name), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(['' if v is None else ('true' if v is True else 'false' if v is False else v) for v in r])


def dept_ok(school, dept):
    return (school or '').startswith('School of ') and bool(dept) and dept not in NON_PROGRAM \
        and not dept.startswith('School of ')


# ---------------------------------------------------------------- metadata
orgs = read('orgs.csv')
outcomes = read('outcomes.csv')
groups = {g['group_key']: g for g in read('groups.csv')}
code_map = read('program_code_map.csv')
alias_dept = {m['program']: m['program_code'] for m in code_map if m['code_type'] == 'Department alias'}
dept_alias = {m['program_code']: m['program'] for m in code_map if m['code_type'] == 'Department alias'}

account_by_path = {o['account_path']: o for o in orgs}
# Academic department accounts (the account named after its department).
academic = sorted({(o['school'], o['department'], o['account_path']) for o in orgs
                   if dept_ok(o['school'], o['department']) and o['account_name'] == o['department']})
schools = sorted({a[0] for a in academic})
depts_in_school = defaultdict(list)
for s, d, p in academic:
    depts_in_school[s].append((s, d, p))


def school_for(name):
    """Map a catalog/school-path school name to a Course[School] value."""
    if not name:
        return None
    for s in schools:
        if name.startswith(s) or s.startswith(name):
            return s
    first = ' '.join(name.split()[:4])
    for s in schools:
        if s.startswith(first):
            return s
    return None


# ---------------------------------------------------------------- terms
def terms():
    out = []
    for y in range(2022, 2027):
        out += [(f'Fall {y}', f'{y}FA', dt.date(y, 8, 22), dt.date(y, 12, 16), y),
                (f'Winter {y + 1}', f'{y + 1}WI', dt.date(y + 1, 1, 5), dt.date(y + 1, 3, 24), y),
                (f'Spring {y + 1}', f'{y + 1}SP', dt.date(y + 1, 3, 30), dt.date(y + 1, 6, 14), y),
                (f'Summer {y + 1}', f'{y + 1}SU', dt.date(y + 1, 6, 20), dt.date(y + 1, 8, 15), y)]
    out.insert(0, ('Summer 2022', '2022SU', dt.date(2022, 7, 1), dt.date(2022, 8, 15), 2022))
    return [t for t in out if t[2] <= END]


TERMS = terms()
AY_WEIGHTS = {2022: 0.17, 2023: 0.20, 2024: 0.22, 2025: 0.24, 2026: 0.17}

# ---------------------------------------------------------------- courses
courses = []          # dicts
course_no = iter(range(101, 101 + N_COURSES))


def new_course(school, dept, path, term, test=False):
    num = next(course_no) if not test else 900 + len([c for c in courses if c['test']]) + 1
    acct = account_by_path.get(path, {})
    c = dict(id=200000 + len(courses) + 1, name=f'Course {num}' + (' TEST' if test else ''),
             code=f'CRS{num}' + ('-TEST' if test else ''), school=school, dept=dept, path=path,
             acct_name=acct.get('account_name') or path.split(' > ')[-1], term=term, test=test)
    courses.append(c)
    return c


# Owning courses: every real owning course (pseudo key) maps to a synthetic course
# in the same account; several real courses share one synthetic course.
owner_accounts = defaultdict(set)
for o in outcomes:
    if o['owner_key']:
        owner_accounts[o['owner_account_path']].add(o['owner_key'])
owner_map = {}
for path in sorted(owner_accounts):
    keys = sorted(owner_accounts[path], key=int)
    n = max(1, round(len(keys) / 8))
    acct = account_by_path.get(path) or {'school': '', 'department': ''}
    made = [new_course(acct['school'] or None, acct['department'] or None, path or 'Loma Linda University', rng.choice(TERMS)) for _ in range(n)]
    for i, k in enumerate(keys):
        owner_map[k] = made[i % n]

# ---------------------------------------------------------------- programs
plos = [o for o in outcomes if o['type'] == 'PLO' and o['program'] and o['program'] not in CLOSED_PROGRAMS]
by_program = defaultdict(list)
for o in plos:
    by_program[o['program']].append(o)


def program_dept(p, outs):
    owned = Counter((o['owner_school'], o['owner_department'], o['owner_account_path']) for o in outs
                    if dept_ok(o['owner_school'], o['owner_department']))
    if owned:
        return owned.most_common(1)[0][0]
    if p in alias_dept:   # department alias: results recorded in that department
        cand = [a for a in academic if a[1] == alias_dept[p]]
        if cand:
            return cand[0]
    school = None
    for o in outs:
        segs = groups[o['group_key']]['path'].split(' > ') if o['group_key'] else []
        if o['program_source'] == 'Catalog path' and len(segs) >= 3:
            school = school_for(segs[2])
        elif o['program_source'] == 'School path':
            school = school_for(segs[0])
        school = school or school_for(o['owner_school'])
        if school:
            break
    school = school or rng.choice(schools)
    return random.Random(p).choice(depts_in_school[school])


prog_names = sorted(by_program)
# Every program-named-by-course-rules program gets results; catalog programs are sampled.
must = sorted({o['program'] for o in plos if o['program_source'] != 'Catalog path'})
sampled = rng.sample([p for p in prog_names if p not in must], 34)
assessed_programs = sorted(set(must) | set(sampled))
prog_dept = {p: program_dept(p, by_program[p]) for p in assessed_programs}

# Watchlist: three smaller programs with every scored result at mastery.
small = [p for p in assessed_programs if p not in must]
watch = sorted(rng.sample(small, N_WATCHLIST))
weights = {p: math.exp(rng.gauss(0, 1.0)) for p in assessed_programs}
for big in must:
    weights[big] *= 3
for p in watch:
    weights[p] = 0
non_watch = TARGET['PLO'] - sum(rng.randint(25, 80) for _ in watch)
total_w = sum(weights.values())
prog_n = {p: max(8, round(non_watch * weights[p] / total_w)) for p in assessed_programs if p not in watch}
for p in watch:
    prog_n[p] = rng.randint(25, 80)
# Mastery: most programs 85-97% (Not Met 3-15%), a few 70-85%.
prog_mastery = {}
for p in assessed_programs:
    prog_mastery[p] = 1.0 if p in watch else (rng.uniform(0.70, 0.85) if rng.random() < 0.15 else rng.uniform(0.85, 0.97))

# ---------------------------------------------------------------- result courses
# Departments that need result courses, with demand.
demand = Counter()
for p in assessed_programs:
    demand[prog_dept[p]] += prog_n[p]
for s in schools:   # non-PLO results spread over each school's departments
    for a in depts_in_school[s]:
        demand[a] += 1
remaining = N_COURSES - len(courses)
dept_list = sorted(demand)
alloc = {a: 1 for a in dept_list}
extra = remaining - len(dept_list)
tot = sum(demand.values())
for a in dept_list:
    alloc[a] += int(extra * demand[a] / tot)
leftover = remaining - sum(alloc.values())
for a in sorted(dept_list, key=lambda a: -demand[a])[:max(0, leftover)]:
    alloc[a] += 1
for a in dept_list:
    k = alloc[a]
    for i in range(k):
        term = TERMS[(i * len(TERMS)) // k + rng.randrange(max(1, len(TERMS) // k))] if k < len(TERMS) else TERMS[i % len(TERMS)]
        new_course(a[0], a[1], a[2], term)
test_courses = [new_course(*rng.choice(academic), rng.choice(TERMS), test=True) for _ in range(N_TEST_COURSES)]

courses_by_dept = defaultdict(list)
courses_by_school = defaultdict(list)
for c in courses:
    if not c['test'] and dept_ok(c['school'], c['dept']):
        courses_by_dept[(c['school'], c['dept'], c['path'])].append(c)
        courses_by_school[c['school']].append(c)


def pick_course(pool, ay):
    inyear = [c for c in pool if c['term'][4] == ay]
    return rng.choice(inyear or pool)


def pick_ay():
    return rng.choices(list(AY_WEIGHTS), weights=list(AY_WEIGHTS.values()))[0]


# ---------------------------------------------------------------- students
FIRST = ('Aaliyah Aiden Alejandro Amara Andre Anika Arjun Ava Benjamin Bianca Caleb Camila Chen Chloe Daniel '
         'Daniela Darius Dev Diego Elena Elijah Emily Esther Ethan Fatima Gabriel Grace Hannah Hiro Imani Isaac '
         'Isabella Jacob Jasmine Javier Jonah Joshua Julia Kai Kayla Kenji Laila Leah Liam Lucia Malik Maria '
         'Mateo Maya Mei Micah Miguel Mila Nadia Naomi Nathan Noah Nora Olivia Omar Priya Rafael Rebecca Ruth '
         'Samuel Sara Sofia Tariq Theo Valeria Victor Wei Yusuf Zara Zoe').split()
# Invented surnames, so no generated "First Last" can be a real person's name.
LAST = ('Aldervane Ambermoor Ashquill Belmorrow Birchwhistle Blythmere Bramblecourt Brisqueton Calderwyn '
        'Candlemoor Cinderhal Clovermast Copperhulme Crestmoor Dapplewick Dawnquist Delvecott Duskmere '
        'Elderquay Embervale Fallowmere Fenwhistle Fernquill Flintmoor Foxhallow Galewright Glimmerton '
        'Gorsemead Hazelquist Heathcombe Hollowmere Ivoryvale Junipercott Kestrelmoor Larkquill Lindenvale '
        'Lockmere Marrowdale Meadowquist Mistcombe Mossharrow Nettlecourt Northquill Oakhallow Orchardine '
        'Pebblemere Pinewhistle Quillmoor Ravenquist Reedmarsh Rimewood Rookhallow Rosequill Rushcombe '
        'Saltmere Sedgewhistle Silverquist Sloeharrow Sparrowdine Stillmoor Stonequill Sumbervale Tamberlyn '
        'Thistlequay Thornquist Tidewhistle Umberdale Vespermoor Wickerquill Willowquist Winterhulme '
        'Wrenmoor Yarrowdale Zephyrcott').split()
assert len(LAST) == 74  # same length as the original list, so every random draw (and all other tables) is unchanged

students = []
school_weight = Counter(c['school'] for c in courses if not c['test'] and c['school'] in schools)
for i in range(N_STUDENTS):
    f, l = rng.choice(FIRST), rng.choice(LAST)
    sid = 300000 + i + 1
    school = rng.choices(list(school_weight), weights=list(school_weight.values()))[0]
    students.append(dict(id=sid, name=f'{f} {l}', sortable=f'{l}, {f}', sis=f'SYN{sid:07d}',
                         login=f'{f[0].lower()}{l.lower()}{i + 1:04d}@example.edu', school=school))
students_by_school = defaultdict(list)
for s in students:
    students_by_school[s['school']].append(s)

roster = {}


def roster_for(c):
    if c['id'] not in roster:
        pool = students_by_school.get(c['school']) or students
        roster[c['id']] = rng.sample(pool, min(len(pool), rng.randint(15, 45)))
    return roster[c['id']]


# ---------------------------------------------------------------- outcomes (model rows)
OUTCOME_BASE = 500000
GROUP_BASE = 700000
out_id = {o['outcome_key']: OUTCOME_BASE + int(o['outcome_key']) for o in outcomes}
# Scale: 90% 4-point (mastery 3 = 0.75, the LLU standard); 10% 5-point (mastery 3 = 0.60).
points = {o['outcome_key']: (5 if rng.random() < 0.10 else 4) for o in outcomes}

# ---------------------------------------------------------------- results
results = []          # dicts
assignments, associations = [], []
course_assoc = {}


def assoc_for(c):
    if c['id'] not in course_assoc:
        lst = []
        for j in range(3):
            aid = 800000 + len(assignments) + 1
            due = c['term'][2] + dt.timedelta(days=rng.randint(20, max(21, (c['term'][3] - c['term'][2]).days - 3)))
            assignments.append([aid, f'Assignment {j + 1}', 100, 'points', 'online_upload', f'{due}T23:59:00', 'published'])
            rid = 900000 + len(associations) + 1
            associations.append([rid, f'Rubric {len(associations) + 1}', 20, f'Assignment {j + 1}', 'grading', True, False])
            lst.append((aid, rid))
        course_assoc[c['id']] = lst
    return course_assoc[c['id']]


def score_for(pts, mastered):
    if mastered:
        return rng.choice([3, 4, 4]) if pts == 4 else rng.choice([4, 5, 5])
    return rng.choice([1, 2, 2]) if pts == 4 else rng.choice([1, 2, 3, 3])


def add_result(o, c, mastered, ay=None, hidden=False, outlier=False):
    t = c['term']
    d0, d1 = max(t[2], START), min(t[3], END)
    day = d0 + dt.timedelta(days=rng.randint(0, max(0, (d1 - d0).days)))
    st = rng.choice(roster_for(c))
    pts = points[o['outcome_key']]
    sc = None if outlier else score_for(pts, mastered)
    quiz = rng.random() < 0.15
    a = None if quiz else rng.choice(assoc_for(c))
    results.append(dict(user=st['id'], course=c['id'], outcome=out_id[o['outcome_key']],
                        assignment=None if quiz else a[0], assoc=None if quiz else a[1],
                        asset='Quizzes::Quiz' if quiz else None,
                        source='Quizzes::QuizSubmission' if quiz else 'RubricAssessment',
                        score=sc, possible=pts, percent=None if sc is None else round(sc / pts, 4),
                        mastery=True if (sc is not None and sc >= 3) else None,
                        hidden=hidden, attempt=1 if rng.random() < 0.93 else 2, date=day, outlier=outlier))


def exact_mastery(n, rate, min_not_met):
    k = 0 if rate >= 1 else max(min_not_met, round(n * (1 - rate)))
    flags = [False] * k + [True] * (n - k)
    rng.shuffle(flags)
    return flags


RESULT_DEPENDENT = {'Cohort shell', 'Recorded-course cohort shell', 'Recorded-course department'}
YEAR_LIFT = {2022: -0.03, 2023: -0.015, 2024: 0.0, 2025: 0.01, 2026: 0.015}

# PLO results: exact Not Met counts per program.
for p in assessed_programs:
    outs = by_program[p]
    chosen = rng.sample(outs, max(1, min(len(outs), round(len(outs) * 0.4) or 1)))
    # Outcomes whose Program comes from where results are recorded (cohort-shell and
    # recorded-course rules) each get at least one result, or they would fall to Unmapped.
    needs = [o for o in outs if o['program_source'] in RESULT_DEPENDENT and o not in chosen]
    pool = courses_by_dept[prog_dept[p]]
    n = prog_n[p]
    for i, m in enumerate(exact_mastery(n, prog_mastery[p], 1 if p not in watch else 0)):
        o = needs[i] if i < len(needs) else rng.choice(chosen + needs)
        add_result(o, pick_course(pool, pick_ay()), m)

# Non-PLO results per type: outcome sample, school mastery rate with a small yearly lift.
school_rate = {s: rng.uniform(0.80, 0.95) for s in schools}


def school_of_outcome(o):
    s = o['owner_school'] if o['owner_school'] in schools else None
    if not s and o['group_key']:
        for seg in groups[o['group_key']]['path'].split(' > '):
            s = school_for(seg) if seg.startswith('School of') else None
            if s:
                break
    return s


for typ in ('Institutional Outcome', 'Course Outcome', 'Accreditation Standard'):
    pool_o = [o for o in outcomes if o['type'] == typ]
    chosen = rng.sample(pool_o, max(1, len(pool_o) // (4 if typ != 'Accreditation Standard' else 2)))
    for _ in range(TARGET[typ]):
        o = rng.choice(chosen)
        s = school_of_outcome(o) or rng.choice(schools)
        own = owner_map.get(o['owner_key'])
        ay = pick_ay()
        c = own if (own and not own['test'] and dept_ok(own['school'], own['dept']) and rng.random() < 0.6) \
            else pick_course(courses_by_school[s], ay)
        add_result(o, c, rng.random() < min(0.98, school_rate[c['school']] + YEAR_LIFT[c['term'][4]]))

# Core values: all seven values x every school x 2025-26 and 2026-27, 1,500 results.
core = [o for o in outcomes if o['type'] == 'Core Value']
cells = [(o, s, ay) for o in core for s in schools for ay in (2025, 2026)]
base, rem = divmod(N_CORE, len(cells))
counts = [base + (1 if i < rem else 0) for i in range(len(cells))]
rng.shuffle(counts)
for (o, s, ay), n in zip(cells, counts):
    pool = [c for c in courses_by_school[s] if c['term'][4] == ay] or courses_by_school[s]
    for _ in range(n):
        add_result(o, rng.choice(pool), rng.random() < school_rate[s] + 0.02)

# Extras that the measures must exclude: hidden results, score outliers, test courses.
visible = list(results)
for r in rng.sample(visible, len(visible) // 100):
    o = next(x for x in outcomes if out_id[x['outcome_key']] == r['outcome'])
    add_result(o, next(c for c in courses if c['id'] == r['course']), rng.random() < 0.5, hidden=True)
course_outcomes = [o for o in outcomes if o['type'] == 'Course Outcome']
for _ in range(20):
    c = rng.choice([c for c in courses if not c['test'] and dept_ok(c['school'], c['dept'])])
    add_result(rng.choice(course_outcomes), c, True, outlier=True)
for c in test_courses:
    for _ in range(60):
        add_result(rng.choice(course_outcomes), c, rng.random() < 0.5)

# ---------------------------------------------------------------- write tables
write('user.csv', ['id', 'name', 'sortable_name', 'sis_user_id', 'login_id', 'workflow_state'],
      [[s['id'], s['name'], s['sortable'], s['sis'], s['login'], 'registered'] for s in students])


def iso(d):
    return f'{d}T00:00:00'


acct_no = {p: i + 1 for i, p in enumerate(sorted({c['path'] for c in courses}))}


write('course.csv', ['id', 'name', 'course_code', 'sis_source_id', 'workflow_state', 'start_at', 'conclude_at',
                     'term_name', 'term_code', 'term_sis_id', 'term_start_at', 'term_end_at', 'acct_name_0',
                     'account_sis_id', 'school', 'department', 'account_path', 'is_test_course'],
      [[c['id'], c['name'], c['code'], f"SYN-{c['code']}-{c['term'][1]}", 'available' if c['term'][3] >= END else 'completed',
        iso(c['term'][2]), iso(c['term'][3]), c['term'][0], c['term'][1], f"SYN-TERM-{c['term'][1]}",
        iso(c['term'][2]), iso(c['term'][3]), c['acct_name'], f"SYN-ACCT-{acct_no[c['path']]:03d}",
        c['school'], c['dept'], c['path'], c['test']] for c in courses])

write('course_section.csv', ['id', 'name', 'sis_source_id', 'default_section'],
      [[600000 + i + 1, c['name'], f"SYN-SEC-{c['code']}-{c['term'][1]}", True] for i, c in enumerate(courses)])
section = {c['id']: 600000 + i + 1 for i, c in enumerate(courses)}

enroll = []
for cid, members in sorted(roster.items()):
    for s in members:
        enroll.append([s['id'], cid, section[cid], 'active' if rng.random() < 0.97 else 'completed'])
write('enrollments.csv', ['user_id', 'course_id', 'course_section_id', 'workflow_state'], enroll)

write('assignment.csv', ['id', 'title', 'points_possible', 'grading_type', 'submission_types', 'due_at', 'workflow_state'], assignments)
write('rubric_association.csv', ['id', 'rubric_title', 'rubric_points_possible', 'title', 'purpose', 'use_for_grading',
                                 'hide_outcome_results'], associations)

write('outcome_results.csv', ['user_id', 'context_id', 'learning_outcome_id', 'assignment_id', 'rubric_association_id',
                              'associated_asset_type', 'artifact_type', 'score', 'possible', 'percent', 'mastery',
                              'hidden', 'attempt', 'assessed_date', 'is_score_outlier'],
      [[r['user'], r['course'], r['outcome'], r['assignment'], r['assoc'], r['asset'], r['source'], r['score'],
        r['possible'], r['percent'], r['mastery'], r['hidden'], r['attempt'], iso(r['date']), r['outlier']] for r in results])

ra = {}
for r in results:
    if r['assoc'] and r['score'] is not None:
        key = (r['user'], r['assoc'])
        prev = ra.get(key)
        ra[key] = [r['user'], r['assoc'], r['course'], r['assignment'], 'grading',
                   (prev[5] if prev else 0) + r['score'], r['attempt'], iso(r['date']), False]
write('rubric_assessments.csv', ['user_id', 'rubric_association_id', 'course_id', 'assignment_id', 'assessment_type',
                                 'score', 'artifact_attempt', 'assessed_date', 'is_score_outlier'], ra.values())

write('outcome_question_results.csv', ['learning_outcome_id', 'user_id', 'context_id', 'score', 'possible', 'percent',
                                       'mastery', 'attempt', 'assessed_date'],
      [[r['outcome'], r['user'], r['course'], r['score'], r['possible'], r['percent'], r['mastery'], r['attempt'],
        iso(r['date'])] for r in results if r['asset'] == 'Quizzes::Quiz' and r['score'] is not None])

# Learning outcomes and groups. Course Outcome titles are generated (faculty free text is not copied).
co = 0
lo_rows = []
for o in outcomes:
    title = o['title']
    if o['type'] == 'Course Outcome' or not title:
        co += 1
        title = f'Course Outcome {co}'
    own = owner_map.get(o['owner_key'])
    lo_rows.append([out_id[o['outcome_key']], title, None, o['context'] or None, o['calc_method'] or None,
                    o['calc_value'] or None, None,
                    GROUP_BASE + int(o['group_key']) if o['group_key'] else None, own['id'] if own else None])
write('learning_outcome.csv', ['id', 'short_description', 'display_name', 'context_type', 'calculation_method',
                               'calculation_int', 'vendor_guid', 'learning_outcome_group_id', 'owning_course_id'], lo_rows)

g_rows = []
for k, g in groups.items():
    own = owner_map.get(g['owner_key'])
    cname = own['name'] if own else 'Course'

    def sub(s):
        return None if s in ('', None) else s.replace('{COURSE}', cname)
    g_rows.append([GROUP_BASE + int(k), sub(g['name']), sub(g['parent']), sub(g['root']), sub(g['path']),
                   int(g['depth']), g['context'], g['truncated'] == 'True'])
write('learning_outcome_group.csv', ['id', 'title', 'parent_group_name', 'root_group_name', 'group_path', 'group_depth',
                                     'context_type', 'path_truncated'], g_rows)

write('mastery_scale.csv', ['context_type', 'context_id', 'description', 'points', 'mastery', 'color'],
      [['Account', 1, 'Exceeds Expectations', 4, False, '02672D'], ['Account', 1, 'Meets Expectations', 3, True, '03893D'],
       ['Account', 1, 'Approaching Expectations', 2, False, 'FAB901'], ['Account', 1, 'Below Expectations', 1, False, 'E62429'],
       ['Account', 2, 'Exemplary', 5, False, '02672D'], ['Account', 2, 'Proficient', 4, False, '03893D'],
       ['Account', 2, 'Competent', 3, True, '0B874B'], ['Account', 2, 'Developing', 2, False, 'FAB901'],
       ['Account', 2, 'Beginning', 1, False, 'E62429']])
write('calculation_method.csv', ['context_type', 'context_id', 'calculation_method', 'calculation_int'],
      [['Account', 1, 'decaying_average', 65], ['Account', 2, 'highest', None]])

# ---------------------------------------------------------------- summary
print(f'students={len(students)} courses={len(courses)} (test {len(test_courses)}) enrollments={len(enroll)} '
      f'results={len(results)} assignments={len(assignments)}')
print('PLO programs with results:', len(assessed_programs), '| watchlist:', '; '.join(watch))
