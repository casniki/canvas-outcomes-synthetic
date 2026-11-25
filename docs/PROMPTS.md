# Prompts used to build this project

These are the prompts used to build the original report with Claude Code, in order. You can use them to reproduce the build against your own Canvas Data 2 warehouse, or as a pattern for a similar project.

## How these prompts were edited

- **Removed:** connection details (warehouse host, account ID, database), personal details, one real Canvas outcome ID, and the replies that only confirmed a save ("saved", "yes"). The removed values are shown as `<placeholders>`.
- **Unchanged:** the wording of the prompts themselves.
- **Not included:** Claude's replies. Prompts that start "Approve…" answer a proposal Claude made in reply to the prompt before; a short note in *italics* says what was proposed.
- **Two builds:** prompts 1–5 built the production project against Amazon Redshift. Prompts 6 onward built the synthetic copy published here.

## Before you start

- **Tools:**
  - Power BI Desktop, with the project saved as a PBIP.
  - Claude Code, with the **powerbi-authoring** plugin. It provides the `semantic-model-authoring` and `powerbi-report-cli` skills and the Power BI modeling MCP server.
  - Node.js, for the report CLI.
  - git.
- **Starting point:** an empty PBIP project open in Desktop (`canvas-outcomes.pbip`) in a git repository.

## Lessons learned

These cost time during the build. Knowing them up front will save you some:

- **Desktop can drop model changes.**
  - Changes made through the MCP server live in the open Desktop model until you save.
  - Desktop can revert that model, and once it has, saving writes the reverted model to disk.
  - So commit as soon as Desktop has saved each change, and check `git status` before saving a window that may have reverted.
- **Refresh from Desktop.**
  - Use **Home → Refresh** after the source data changes.
  - Don't start a refresh from outside Desktop through XMLA. It hung for 30 minutes and left the window unusable.
  - Avoid **Close & Apply** in Power Query during a build.
- **Reloads look like unsaved changes.** After the report CLI reloads the window, Desktop reports unsaved changes even though nothing changed in the model. Desktop also rewrites the report files when it saves, so run `node tools/build_report.js 4` after every save to put the report back in its generated form.
- **Generate the report.**
  - Building the PBIR from one script (`tools/build_report.js`) made later restyling (fonts, header icons, a banner) a one-line change for all 48 visuals.
  - The validate → reload → screenshot loop catches overruns that validation alone misses.

---

## Stage 1 — Semantic model (production)

### 1. Import the Canvas Data 2 tables

> Power BI Desktop is open with the empty project canvas-outcomes.pbip. Use the semantic-model-authoring skill and the Power BI MCP server to connect to the open model and build the Canvas outcomes semantic model from Amazon Redshift.
>
> Source: server `<workgroup>.<account-id>.<region>.redshift-serverless.amazonaws.com:5439`, database `<database>`, schema public. The credential is already cached in Desktop. Use only the Canvas Data 2 tables (plain plural names); ignore the legacy *_dim and *_fact tables.
>
> Tables to import: learning_outcomes, learning_outcome_results, learning_outcome_groups, learning_outcome_question_results, learning_outcome_rubric_criteria, outcome_proficiencies, outcome_proficiency_ratings, outcome_calculation_methods, rubrics, rubric_assessments, rubric_associations, courses, course_sections, enrollment_terms, accounts, enrollments, users, pseudonyms, assignments.
>
> Rules: Import mode. Write the Power Query so it folds to Redshift. Exclude rows where workflow_state = 'deleted'. Filter learning_outcome_results and rubric_assessments to records created on or after 2022-07-01. Bring in only the columns needed for outcomes analysis; drop large text and JSON columns. Propose a star schema with learning_outcome_results as the fact table and show me the table list, column list, and relationships before creating anything. Do not create measures yet. After I approve, create the tables, refresh, and report row counts per table.

*Claude proposed a star schema and a numbered list of decisions.*

> Approve with two changes. (1) Decision 2: instead of a single Outcome Group column, create a Learning Outcome Group lookup table from learning_outcome_groups with the parent chain (group name, parent group name, and a full path from the root), and link Learning Outcome to it through content_tags, picking the group in the outcome's own context when there are several. (2) Course: walk the account hierarchy to the root and add School and Department columns (or an Account Path column if the depth varies). Accept all other defaults including UTC dates. Then create the tables, refresh, report row counts per table, commit with the message "Canvas Data 2 tables imported from Redshift", and start BUILD_LOG.md with an entry covering these decisions, including the UTC date note.

**Follow-ups:**
- "OOPS I think PBI reverted as nothing is there" (Desktop had dropped the new tables, so they were rebuilt).
- A refresh error from Desktop was pasted as a screenshot.
- "let's exclude the outliers" (results flagged as score outliers are excluded).

### 2. Design the outcome-type and program layer

> Design the program and outcome-type layer for canvas-outcomes. Do not change the model yet; propose first.
>
> 1. Profile the Learning Outcome Group paths and the Learning Outcome titles. Show me the patterns you find for program-level PLO groups, course-level PLO titles, the LLU Values Alignment group, and everything else, with counts of outcomes and results in each.
> 2. Propose an Outcome Type column on Learning Outcome with values Core Value, PLO, and Course Outcome, and the rule for each.
> 3. Propose how to derive Program for PLO outcomes: from the group path where it names a program, otherwise from the course's Department, and show how many outcomes and results each rule would cover and how many remain unmapped. Note that a Course SIS ID to Banner program crosswalk will be added later as the authoritative source.
> 4. Propose the first measures: Assessed Students (distinct users), Pct at Mastery (LLU standard: Score divided by Points Possible at or above 0.75), Pct at Mastery (Canvas flag: Is Mastery), Coverage (outcomes with at least one result divided by outcomes in scope), Not Met Rate, and Year over Year change in Pct at Mastery by academic year.
>
> Report findings and the proposal as a short table. I'll approve before you build.

*Claude profiled the paths and titles and proposed the rules and measures.*

> Approve with these decisions.
> 1. Add Institutional Outcome as a fourth type. Also add a fifth type, Accreditation Standard, for outcomes matching CODA, CAPE, or NAPLEX, applied before the Course Outcome fallback.
> 2. Cohort codes confirmed: DH = Dental Hygiene — B.S., IDP = International Dentist Program — D.D.S., DDS = Dentistry — D.D.S. Put the lookup in a small table in the model so I can edit it, and use these exact program names so they can be matched to my program register later.
> 3. Exclude Is Hidden results from all mastery and Not Met measures; say so in each measure description.
> 4. Add an Is Test Course flag on Course (pattern-based on the course name, including "Test" and "OEE") and exclude flagged courses from all measures by default.
> 5. Pct at Mastery (LLU) is the default. Name the other "Pct at Mastery (Canvas flag)" and describe it as a cross-check.
>
> Put Program on Learning Outcome as proposed, including the hidden owning-course column. Build the columns, lookup table, and measures in one pass, write them to the PBIP files, refresh, report the headline values by Outcome Type, commit, and add a BUILD_LOG.md entry covering the profile findings and these five decisions.

### 3. Widen program resolution

*Claude reported the remaining unmapped PLOs and offered options (a)–(c).*

> Approve options (a) and (b); (c) comes later.
> (a) Extend Cohort Program Map into a general Program Code Map: a code column (DDS, DH, IDP, MHA, BS/TM, and others I'll add) and a program name column. Apply it both to cohort shell names ("~DH Class of 2026") and to PLO titles where the code appears as a whole word next to PLO ("PLO DDS 9", "MHA PLO 3", "BS/TM PLO 2"). Seed it with MHA = Health Care Administration — M.H.A. and BS/TM = Technology Management — B.S. (correct the names from the catalog path if they differ there).
> (b) Add a recorded-course fallback: when the owning course gives no program, use the program of the course where most of that outcome's results were recorded, via the department rule.
>
> Rule order: catalog path, school path, title code, cohort shell, owning-course department, recorded-course department, unmapped. Keep Program Source showing which rule fired.
>
> Rebuild Program, refresh, and show me the updated Program Source table plus a list of any remaining unmapped PLO outcomes that have results, with their owning course and result count. Commit and add a BUILD_LOG.md entry.

## Stage 2 — Report (production)

### 4. Build the four pages

> Use the powerbi-report-cli skill to build a 4-page report on the open canvas-outcomes model, with the validate, reload, and screenshot loop until every page renders cleanly. Show me the page plan before writing any PBIR files, and commit after each page renders with a BUILD_LOG.md entry.
>
> Model reference: fact table Outcome Results; Learning Outcome (Outcome Type, Program, Program Source, Outcome Title); Learning Outcome Group (group path); Course (School, Department, Course Name, Is Test Course); Date (Academic Year, Date). Measures on Outcome Results: Assessed Students, Pct at Mastery (LLU), Pct at Mastery (Canvas flag), Coverage, Not Met Rate, Pct at Mastery YoY, plus hidden Scored Results and Mastered Results.
>
> Before building page 4, add two measures to Outcome Results: Watchlist Flag = 1 when Scored Results >= 20 and Not Met Rate = 0, otherwise blank; and Programs on Watchlist = count of programs where Watchlist Flag = 1, evaluated at Learning Outcome[Program] grain. Describe both.
>
> Global rules: no visual may use user names, SIS IDs, login IDs, or instructor fields; the Course Name may appear only on page 2's drillthrough. Every page has a title top-left, a one-line subtitle beneath it, and slicers in a left-hand band. 16:9 canvas. Theme: navy #0B2545, ice blue #8FCBEB, gold #C8952A accents; Cambria headings, Calibri body. Add a small "Data as of" text using the max Date in Outcome Results on every page.
>
> Page 1 "Institution Overview", subtitle "Outcome mastery across the university". KPI cards: Assessed Students, Pct at Mastery (LLU), Coverage, Pct at Mastery YoY. Bar chart of Pct at Mastery (LLU) by Course[School], sorted descending. Line chart of Pct at Mastery (LLU) by Date[Academic Year]. Slicers: Learning Outcome[Outcome Type] defaulting to PLO, Date[Academic Year]. Enable drillthrough from the School bar to page 2 on Course[School].
>
> Page 2 "Program Drill-Down", subtitle "Program learning outcomes by year". Page filter Outcome Type = PLO. Matrix: Learning Outcome[Outcome Title] on rows, Date[Academic Year] on columns, values Pct at Mastery (LLU) and Scored Results. Bar chart of Assessed Students by Learning Outcome[Program], sorted descending. A small table of Program, Program Source, Scored Results, so the mapping rule is visible. Slicers: Course[School], Learning Outcome[Program]. Drillthrough target on Course[School].
>
> Page 3 "Core Values", subtitle "Mastery of LLU's seven core values (baseline)". Page filter Outcome Type = Core Value. Cards: Assessed Students, Scored Results. Bar chart of Pct at Mastery (LLU) by Learning Outcome[Outcome Title] showing all seven values even with no data (turn on "show items with no data"). Matrix of Outcome Title by Course[School], value Scored Results. A text box reading "Core-value outcomes were added to Canvas in 2026. This page shows the assessment baseline and will populate as programs align assessments to the LLU Values." Slicer: Course[School] only.
>
> Page 4 "Assessment Quality Watchlist", subtitle "Programs with 20 or more scored PLO results and no Not Met outcomes". Page filter Outcome Type = PLO. Cards: Programs on Watchlist, Not Met Rate (institution-wide). Table: Learning Outcome[Program], Course[School], Scored Results, Pct at Mastery (LLU), Not Met Rate, Assessed Students, filtered to Watchlist Flag = 1, sorted by Scored Results descending. Bar chart of Not Met Rate by Course[School]. Slicers: Course[School], Date[Academic Year]. A short text box explaining that a zero Not Met rate over many results usually means the assessment can't distinguish levels, not that every student mastered.
>
> After all four pages render, save screenshots of each page as png files in a screenshots folder, commit, and report the watchlist count and the institution-wide Not Met rate.

*Claude wrote the page plan, which is [report-spec.md](report-spec.md), and flagged decisions.*

> Approve with three changes before building.
> 1. Fix the naming split first: add department-name aliases to the Program Code Map so "Dental Hygiene" resolves to "Dental Hygiene — B.S." and the other department-rule names ("Communication Sci & Disorders", "Hlth Info, Info Mgmt, & Admin", "Orthotics and Prosthetics") resolve to their register names. Refresh, confirm the watchlist count, and commit.
> 2. Default page 1's Academic Year slicer to 2025-26.
> 3. On page 4, rename the Not Met card to "PLO Not Met Rate" and add a second card, "All Outcomes Not Met Rate", that ignores the page's Outcome Type filter.
>
> Then install the CLI and build pages 1-4 as planned, with a commit after each page.

### 5. Fix-ups after testing

> drillthrough works, tested it Orthotics and Prosthetics is a closed program. Add the alias to the Program Code Map using its register name ("Orthotics and Prosthetics — M.S." unless the catalog path shows a different degree), and note in BUILD_LOG.md that the program is closed and currently has no results. Also add a visual-level filter on page 2's program bar chart so Program is not blank, log that outcome `<outcome id>` (1 result) is excluded from that chart by this filter, rebuild page 2 with node tools/build_report.js, validate, and commit.

## Stage 3 — Synthetic copy (this repository)

### 6. Create the synthetic sibling

> Create a synthetic-data sibling of this project at C:\code\canvas-outcomes-synthetic. Do not modify this project.
>
> 1. Write tools/make_synthetic.py. It may read from the real model only institutional metadata: the distinct School, Department, and Program values, the Learning Outcome table's titles, types, groups, and programs, and the Program Code Map. It must not read or copy any User, Enrollment, Course Name, instructor, or Outcome Results row. Generate CSV files in .\data that match the column shapes of each model table: roughly 3,000 fake students with fake names and SIS IDs, 400 fake courses across the real departments with generic names like "Course 312", enrollments, and about 60,000 outcome results from 2022-07-01 to 2026-10-31. Score distributions: Pct at Mastery (LLU) varying by program between 70% and 97%, with Not Met rates spread so that 2 or 3 programs with 20+ results have zero Not Met and most have 3-15%. Include core-value results for all seven values across every school in 2025-26 and 2026-27, 1,500 results total. Keep the Canvas Is Mastery flag consistent with scores at roughly a 4-point rubric mastery of 3. Use a fixed random seed.
>
> 2. Copy the PBIP, tools, and BUILD_LOG.md to the sibling project. Replace each table's Power Query source with the matching CSV in .\data, keeping column names and types identical so every measure, relationship, and page works unchanged. Remove the Redshift server and database parameters entirely; no trace of the real connection may remain.
>
> 3. Open the sibling in Desktop, refresh, validate all four pages, regenerate screenshots, and report the headline table by Outcome Type and the watchlist programs.
>
> 4. Initialize git in the sibling with a README stating that all data is synthetic and that school, department, program, and outcome names are real LLU institutional metadata. First commit.
>
> Show me the plan before writing anything.

*Claude proposed a plan with four decisions.*

> Approve. Decision 1: do not copy BUILD_LOG.md. Create a fresh one for the synthetic project that restates the design decisions in general terms (outcome types and rules, program resolution order, 75% mastery standard, exclusions for hidden results and test courses, UTC date handling) with no result counts, IDs, course names, or hosts, and a one-line pointer to the private production repo for full history. Decisions 2, 3, and 4: recommended. Start.

## Stage 4 — Polish

### 7. Slicer selection color

> on the first overview page the PLO under outcome type doesn't show the selection box clearly as it is the selected item

### 8. Larger fonts

> can you enlarge fonts where possible? I don't want overruns so keep within bounds

### 9. Header icons off

> can you turn off all the header icons in the report - they get in the way when viewing. Don't make it universal so that if I want a table to show it I can just turn on that table.

### 10. Synthetic-data banner

> shouldn't the report say all results are sythetic? There is room on the report pages

## Stage 5 — Publishing safely

### 11. Publish to GitHub without personal information

> I would like to put the sythetic build on github so that conference attendees can mirror the build. How should we go about that making sure no student or faculty PIP are published?

*Claude proposed six steps:*
1. Scrub real IDs and course codes from code comments.
2. Check every file against the real user roster, held in memory only.
3. Replace the generator's surnames with invented ones, so no fake student can share a real person's name.
4. Publish a single-commit copy under a GitHub no-reply address, with no history.
5. Add licenses and a mirroring guide.
6. Push privately first, then make the repo public after review.

> I think I better use my name so it doesn't look like an official LLU product

> go, push it private

> make it public

### 12. Check the prompts are in the repo

> does the repo have all the prompts in it?

*That question produced this file.*
