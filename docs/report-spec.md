# Report Spec — Canvas Outcomes

> **About this file.** This is the page plan Claude Code wrote before building the report (see prompt 4 in [PROMPTS.md](PROMPTS.md)), and it was approved with the three changes listed there.
>
> **What was removed.** It was written against the production model. The figures it quoted from production data are replaced with general descriptions, and nothing else is changed.
>
> **What changed after approval.** The report has changed since this plan. Fonts were enlarged, some layouts were adjusted, header icons were hidden, and the synthetic copy gained a "Synthetic data" banner. `BUILD_LOG.md` records each change.

## Report identity
- Report name: canvas-outcomes (report folder `canvas-outcomes.Report`)
- Semantic model: canvas-outcomes (local PBIP semantic model, Import from Amazon Redshift / Canvas Data 2; the synthetic copy reads the same tables from CSV files)
- Audience: LLU assessment leadership, deans and program directors (AAIR-style outcomes review)
- Primary purpose: track outcome mastery across the university, drill into program PLOs, baseline core values, and flag programs whose assessments may not discriminate between levels
- Delivery target: local PBIP only (no Fabric publish)

## Semantic model binding
- Entry mode: Local Model
- Model name: canvas-outcomes
- connectionString: byPath `../canvas-outcomes.SemanticModel` (already set in `definition.pbir`; unchanged)

## User decisions and constraints
- Scope: 4 pages, as specified by the user (Institution Overview, Program Drill-Down, Core Values, Assessment Quality Watchlist). The empty default "Page 1" is replaced.
- Page count: 4
- Interactivity:
  - Navigation uses the built-in page tabs; there is no custom navigator.
  - Drillthrough runs from the Page 1 School bar to Page 2 on `Course[School]`. Page 2 gets a Back button.
  - Slicers sit in a left-hand rail on every page.
  - Default cross-filtering applies (Filter).
- Design direction: navy #0B2545, ice blue #8FCBEB, gold #C8952A accents; Cambria headings, Calibri body; 16:9 canvas.
- Publishing: none.
- Tooling:
  - Power BI Desktop is open on `canvas-outcomes.pbip`.
  - The powerbi-modeling-mcp server is connected.
  - Node.js is installed.
  - The `powerbi-report-author` CLI is **not installed**. On approval I'll run `npm install -g @microsoft/powerbi-report-authoring-cli@latest`.
- Model edit permissions: approved for three measures (see Model requirements).
- Privacy rules:
  - No visual uses user names, SIS IDs, login IDs or instructor fields.
  - `Course[Course Name]` is used by no visual. It is allowed only on the Page 2 drillthrough, and the plan doesn't need it there.
- Accessibility: WCAG AA text contrast. Ice blue is used only for fills and bars, never for text on white. Every chart has alt text.
- Data caveats (verified by query against production; figures omitted here):
  - **Core values:** Core Value outcomes had no scored results outside test courses yet, so Page 3 would render the 7 values with blank bars and an empty matrix. This is expected; the text box explains it. (The synthetic data does include core-value results.)
  - **Watchlist preview:** 2 programs qualified.
    - One of them was a program listed under its department-rule name.

    The same program under its register name had many more results and a small Not Met rate, so it narrowly missed. This is a Program-naming split, not a measure error. It was fixed by approval change 1 (department-name aliases in the Program Code Map).
  - **Not Met on Page 4:** the Page 4 page filter is PLO, so the "institution-wide" Not Met card shows the PLO Not Met rate, which is lower than the all-type rate. This led to approval change 3: a second card for All Outcomes Not Met Rate.
  - **YoY with no year selected:** `Pct at Mastery YoY` shows 0.0% when no Academic Year is selected, because it compares the full date range with itself shifted one year.

    **Decision needed:** default the Page 1 Academic Year slicer to **2025-26** (recommended), or leave it unselected as specified. (Approved: 2025-26.)

## Narrative
- Core story: overall mastery is high (most scored results meet the LLU 0.75 standard), but coverage is thin and some programs report no "Not Met" results at all.
- Audience promise: one landing page for the university picture, a program view for evidence, a core-value baseline, and a watchlist of assessment-quality risks.
- Key questions answered:
  - How many students were assessed, at what mastery rate, and is it improving?
  - Which schools and programs drive the results?
  - Have the LLU core values been assessed yet?
  - Which programs' assessments fail to distinguish performance levels?

## Design identity
- Tone: Institutional Navy. A restrained academic report: navy structure, white canvas, a gold accent for change and risk, Cambria serif headings.
- Signature: a gold rule under each page title, and a navy filter rail on the left that repeats on every page.

## Page plan
1. **Institution Overview** (subtitle "Outcome mastery across the university")
   - Archetype: Executive Summary, variant B (filter rail + KPI strip + two analysis panels).
   - Purpose: the university-wide mastery picture.
   - Visuals:
     - KPI cards: Assessed Students, Pct at Mastery (LLU), Coverage, Pct at Mastery YoY.
     - Bar chart: Pct at Mastery (LLU) by Course[School], sorted descending; drillthrough source.
     - Line chart: Pct at Mastery (LLU) by Date[Academic Year].
   - Slicers: Learning Outcome[Outcome Type] (list, default PLO); Date[Academic Year] (dropdown).
2. **Program Drill-Down** (subtitle "Program learning outcomes by year")
   - Archetype: Analytical Canvas.
   - Page filter: Outcome Type = PLO. Drillthrough target on Course[School]; Back button.
   - Visuals:
     - Matrix: Outcome Title × Academic Year, values Pct at Mastery (LLU) and Scored Results.
     - Bar chart: Assessed Students by Program, sorted descending.
     - Mapping table: Program, Program Source, Scored Results.
   - Slicers: Course[School], Learning Outcome[Program].
3. **Core Values** (subtitle "Mastery of LLU's seven core values (baseline)")
   - Archetype: Operational Monitor (baseline status).
   - Page filter: Outcome Type = Core Value.
   - Visuals:
     - Cards: Assessed Students, Scored Results.
     - Bar chart: Pct at Mastery (LLU) by Outcome Title, with "show items with no data" on.
     - Matrix: Outcome Title × School, value Scored Results.
     - Text box (user-supplied text).
   - Slicer: Course[School].
4. **Assessment Quality Watchlist** (subtitle "Programs with 20 or more scored PLO results and no Not Met outcomes")
   - Archetype: Operational Monitor (exception list).
   - Page filter: Outcome Type = PLO.
   - Visuals:
     - Cards: Programs on Watchlist, Not Met Rate.
     - Explanatory text box.
     - Watchlist table: Program, School, Scored Results, Pct at Mastery (LLU), Not Met Rate, Assessed Students. Visual filter Watchlist Flag = 1; sorted by Scored Results descending.
     - Bar chart: Not Met Rate by School.
   - Slicers: Course[School], Date[Academic Year].

**All pages:**
- Title at top left, subtitle beneath it, gold rule.
- "Data as of" in the top-right header.
- Left slicer rail.
- 1920 × 1080 (16:9).

## Design system summary
- **Theme:** custom `LLU-Outcomes` theme (adapted from the skill base theme).
  - Data colors: #0B2545, #8FCBEB, #C8952A, #5C7A99, #13315C, #B8D8EE, #E3C27F, #7F8C9A.
  - Page background: #FFFFFF. Rail background: #0B2545 with white slicer text.
- **Color semantics:**
  - Pct at Mastery (LLU) → navy #0B2545.
  - Assessed Students and Scored Results → #5C7A99, steel.
  - Coverage → ice #8FCBEB (fill) with navy text.
  - Not Met Rate and Pct at Mastery YoY → gold #C8952A.
- **Typography:** Cambria (titles 24pt; card values 28pt). Calibri (body, labels, slicers: 10–12pt; subtitle 12pt).
- **Layout:** 12 × 12 grid, 32 px margin, 24 px gutter, 8 px snap. The left rail is 2 columns; the header row holds title, subtitle and "Data as of".
- **Accessibility:**
  - Text contrast is at least 4.5:1: navy on white, white on navy, and gold used only for bars and accents.
  - Every chart has alt text.
  - Long slicers (Program, School) are searchable dropdowns.

## Model requirements
- **Existing measures:**
  - Visible: Assessed Students, Pct at Mastery (LLU), Pct at Mastery (Canvas flag), Coverage, Not Met Rate, Pct at Mastery YoY.
  - Hidden: Scored Results, Mastered Results.
  - **Scored Results** is hidden but used by visuals on Pages 2–4. I'll unhide it (display folder Core KPIs) so it shows in the field list.
- **New measures (on Outcome Results):**
  - `Data As Of` (before Page 1): `"Data as of " & FORMAT ( CALCULATE ( MAX ( 'Outcome Results'[Assessed Date] ), REMOVEFILTERS () ), "mmm d, yyyy" )`. Ignores slicers so every page shows the same refresh horizon.
  - `Watchlist Flag` (before Page 4): `IF ( [Scored Results] >= 20 && [Not Met Rate] = 0, 1 )`. The value is 1 when the current context (e.g. a program row) has 20 or more scored, non-hidden, non-test results and none below the LLU 0.75 standard; otherwise blank.
  - `All Outcomes Not Met Rate` (before Page 4; user change 3): `CALCULATE ( [Not Met Rate], REMOVEFILTERS ( 'Learning Outcome'[Outcome Type] ) )`. This is the Not Met rate across all outcome types: it ignores the page's Outcome Type filter but still respects the School and Academic Year slicers. Page 4 shows it next to the Not Met Rate card, which is relabelled "PLO Not Met Rate".
  - `Programs on Watchlist` (before Page 4): `COUNTROWS ( FILTER ( VALUES ( 'Learning Outcome'[Program] ), NOT ISBLANK ( 'Learning Outcome'[Program] ) && [Watchlist Flag] = 1 ) )`. Evaluated at Program grain, so a program counts once even if it spans schools. The watchlist table is Program × School, so a program could appear on more than one row.
- **New calculated columns:** none.
- **Relationship/sort requirements:** none. Academic Year sorts correctly as text ("2022-23" … "2026-27").

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-cli
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: "Institutional Navy - restrained academic reporting; white canvas, navy structure, gold for change and risk, Cambria serif headings over Calibri body"
    signature: "Gold rule under each page title plus a navy left filter rail repeated on every page"
  archetype: Executive Summary
  navigation_model: none
  color_map:
    - measure: Outcome Results[Pct at Mastery (LLU)]
      color: "#0B2545"
      tint: "#D9E2EC"
    - measure: Outcome Results[Assessed Students]
      color: "#5C7A99"
      tint: "#E3EAF1"
    - measure: Outcome Results[Scored Results]
      color: "#5C7A99"
      tint: "#E3EAF1"
    - measure: Outcome Results[Coverage]
      color: "#8FCBEB"
      tint: "#E8F5FB"
    - measure: Outcome Results[Not Met Rate]
      color: "#C8952A"
      tint: "#F6EAD3"
    - measure: Outcome Results[Pct at Mastery YoY]
      color: "#C8952A"
      tint: "#F6EAD3"
    - measure: Outcome Results[Programs on Watchlist]
      color: "#C8952A"
      tint: "#F6EAD3"
  pages:
    - name: Institution Overview
      role: landing
      archetype: Executive
      layout_variant: B
      variant_rationale: "Four headline KPIs plus two comparable analysis panels (school ranking and yearly trend) fit an executive strip over balanced halves; slicers move to the required left rail."
      navigation: []
      page_background: "#FFFFFF"
      layout_summary: "Header band with title, subtitle, gold rule and Data as of; navy left rail with two slicers; KPI strip; school bar (drillthrough source) left and academic-year trend right."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 10, 2]
            data_as_of: [10, 1, 13, 2]
            rail: [1, 2, 3, 13]
            kpis: [3, 2, 13, 4]
            school_bar: [3, 4, 8, 13]
            trend: [8, 4, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Institution Overview"
            purpose: "Name the page; Cambria 24pt navy with gold rule beneath."
            slot: 1
            of: 2
          - id: page_subtitle
            region: header
            kind: textbox
            text: "Outcome mastery across the university"
            purpose: "One-line context, Calibri 12pt steel."
            slot: 2
            of: 2
          - id: data_as_of
            region: data_as_of
            kind: cardVisual
            field_bindings: Outcome Results[Data As Of]
            purpose: "Show the refresh horizon (max assessed date) on every page."
            insight_basis: "Data recency, not a KPI; small Calibri 10pt text, no card chrome."
            color_strategy: none
          - id: outcome_type_slicer
            region: rail
            kind: slicer
            field_bindings: Learning Outcome[Outcome Type]
            slicer_type: list
            default_selection: ["PLO"]
            slot: 1
            of: 2
          - id: academic_year_slicer
            region: rail
            kind: slicer
            field_bindings: Date[Academic Year]
            slicer_type: dropdown
            default_selection: ["2025-26"]
            slot: 2
            of: 2
          - id: kpi_assessed_students
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Assessed Students]
            purpose: "How many distinct students were assessed?"
            color_strategy: measure_match
            slot: 1
            of: 4
          - id: kpi_pct_mastery
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Pct at Mastery (LLU)]
            purpose: "What share of scored results meet the LLU 0.75 standard?"
            color_strategy: measure_match
            slot: 2
            of: 4
          - id: kpi_coverage
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Coverage]
            purpose: "What share of outcomes in scope have been assessed?"
            color_strategy: measure_match
            slot: 3
            of: 4
          - id: kpi_yoy
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Pct at Mastery YoY]
            purpose: "Is mastery improving versus the prior academic year?"
            comparison_basis: "Same period one year earlier (DATEADD -1 year)"
            color_strategy: measure_match
            slot: 4
            of: 4
          - id: mastery_by_school
            region: school_bar
            kind: barChart
            purpose: "Which schools have the highest and lowest mastery rates? (right-click to drill through to Program Drill-Down)"
            field_bindings: { Category: Course[School], Y: Outcome Results[Pct at Mastery (LLU)] }
            sort_policy: value_desc
            color_strategy: measure_match
            drillthrough_target: Program Drill-Down
          - id: mastery_trend
            region: trend
            kind: lineChart
            purpose: "How has mastery changed by academic year?"
            field_bindings: { Category: Date[Academic Year], Y: Outcome Results[Pct at Mastery (LLU)] }
            sort_policy: category_asc
            color_strategy: measure_match
        space_audit:
          content_cell_count: 110
          placed_cell_count: 110
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: school_bar, pct_of_content: 41 }
          balance_rationale: "KPI strip (20 cells) sits over two equal 45-cell panels; neither chart dominates, so ranking and trend read as peers."
    - name: Program Drill-Down
      role: drillthrough
      archetype: Analytical
      layout_variant: A
      variant_rationale: "The outcome-by-year matrix (well over a hundred PLO titles with results) is the evidence the page exists for, so it gets the dominant region; program ranking and the mapping-rule table support it."
      page_filters: [ "Learning Outcome[Outcome Type] = PLO" ]
      drillthrough_fields: [ Course[School] ]
      navigation:
        - element: button
          action: Back
          label: "Back to Institution Overview"
      page_background: "#FFFFFF"
      layout_summary: "Header band; rail with School and Program dropdowns and a Back button; matrix left (hero); program bar top-right; Program/Program Source table bottom-right."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 10, 2]
            data_as_of: [10, 1, 13, 2]
            rail: [1, 2, 3, 13]
            matrix: [3, 2, 9, 13]
            program_bar: [9, 2, 13, 8]
            mapping: [9, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Program Drill-Down"
            slot: 1
            of: 2
          - id: page_subtitle
            region: header
            kind: textbox
            text: "Program learning outcomes by year"
            slot: 2
            of: 2
          - id: data_as_of
            region: data_as_of
            kind: cardVisual
            field_bindings: Outcome Results[Data As Of]
            insight_basis: "Data recency"
            color_strategy: none
          - id: school_slicer
            region: rail
            kind: slicer
            field_bindings: Course[School]
            slicer_type: dropdown
            slot: 1
            of: 3
          - id: program_slicer
            region: rail
            kind: slicer
            field_bindings: Learning Outcome[Program]
            slicer_type: dropdown
            slot: 2
            of: 3
          - id: back_button
            region: rail
            kind: actionButton
            text: "Back to Institution Overview"
            action: Back
            slot: 3
            of: 3
          - id: outcome_year_matrix
            region: matrix
            kind: pivotTable
            purpose: "How did each PLO perform by academic year, and on how many scored results?"
            field_bindings: { Rows: Learning Outcome[Outcome Title], Columns: Date[Academic Year], Values: [Outcome Results[Pct at Mastery (LLU)], Outcome Results[Scored Results]] }
            sort_policy: category_asc
            color_strategy: none
          - id: students_by_program
            region: program_bar
            kind: barChart
            purpose: "Which programs assessed the most students?"
            field_bindings: { Category: Learning Outcome[Program], Y: Outcome Results[Assessed Students] }
            sort_policy: value_desc
            color_strategy: measure_match
          - id: program_mapping
            region: mapping
            kind: tableEx
            purpose: "Which rule assigned each program, and how much evidence sits behind it?"
            field_bindings: [Learning Outcome[Program], Learning Outcome[Program Source], Outcome Results[Scored Results]]
            sort_policy: value_desc
            color_strategy: none
        space_audit:
          content_cell_count: 110
          placed_cell_count: 110
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: matrix, pct_of_content: 60 }
          balance_rationale: "Analytical variant A: the matrix is the page's hero (many outcome rows x five years); the two supporting visuals keep 4 columns x 5-6 rows each, which is enough for ~7 program bars and a short mapping table."
    - name: Core Values
      role: detail
      archetype: Operational
      layout_variant: A
      variant_rationale: "A baseline status page: two counts and an explanation on top, then the seven-value bar and value-by-school matrix as peers."
      page_filters: [ "Learning Outcome[Outcome Type] = Core Value" ]
      navigation: []
      page_background: "#FFFFFF"
      layout_summary: "Header band; rail with School dropdown; two cards and the baseline text box; seven-value bar left and value-by-school matrix right."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 10, 2]
            data_as_of: [10, 1, 13, 2]
            rail: [1, 2, 3, 13]
            kpis: [3, 2, 8, 4]
            baseline_note: [8, 2, 13, 4]
            values_bar: [3, 4, 8, 13]
            values_matrix: [8, 4, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Core Values"
            slot: 1
            of: 2
          - id: page_subtitle
            region: header
            kind: textbox
            text: "Mastery of LLU's seven core values (baseline)"
            slot: 2
            of: 2
          - id: data_as_of
            region: data_as_of
            kind: cardVisual
            field_bindings: Outcome Results[Data As Of]
            insight_basis: "Data recency"
            color_strategy: none
          - id: school_slicer
            region: rail
            kind: slicer
            field_bindings: Course[School]
            slicer_type: dropdown
          - id: kpi_assessed_students
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Assessed Students]
            purpose: "How many students have a core-value result?"
            color_strategy: measure_match
            slot: 1
            of: 2
          - id: kpi_scored_results
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Scored Results]
            purpose: "How many core-value results are scored?"
            color_strategy: measure_match
            slot: 2
            of: 2
          - id: baseline_note
            region: baseline_note
            kind: textbox
            text: "Core-value outcomes were added to Canvas in 2026. This page shows the assessment baseline and will populate as programs align assessments to the LLU Values."
            insight_basis: "Explains why the page is empty in production (no scored core-value results outside test courses yet)."
          - id: mastery_by_value
            region: values_bar
            kind: barChart
            purpose: "What is the mastery rate for each of the seven core values?"
            field_bindings: { Category: Learning Outcome[Outcome Title], Y: Outcome Results[Pct at Mastery (LLU)] }
            show_items_with_no_data: true
            sort_policy: category_asc
            color_strategy: measure_match
          - id: value_by_school
            region: values_matrix
            kind: pivotTable
            purpose: "Which schools have scored core-value results?"
            field_bindings: { Rows: Learning Outcome[Outcome Title], Columns: Course[School], Values: Outcome Results[Scored Results] }
            sort_policy: category_asc
            color_strategy: none
        space_audit:
          content_cell_count: 110
          placed_cell_count: 110
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: values_bar, pct_of_content: 41 }
          balance_rationale: "Cards and the baseline note share the top band (10 cells each); bar and matrix are equal 45-cell peers so the seven values stay readable even while blank."
    - name: Assessment Quality Watchlist
      role: detail
      archetype: Operational
      layout_variant: B
      variant_rationale: "An exception list: the watchlist table is the action queue and gets the dominant region; the school Not Met bar gives context."
      page_filters: [ "Learning Outcome[Outcome Type] = PLO" ]
      navigation: []
      page_background: "#FFFFFF"
      layout_summary: "Header band; rail with School and Academic Year; two cards and the explanation text; watchlist table left (hero) and Not Met by School bar right."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 10, 2]
            data_as_of: [10, 1, 13, 2]
            rail: [1, 2, 3, 13]
            kpis: [3, 2, 8, 4]
            explainer: [8, 2, 13, 4]
            watchlist: [3, 4, 9, 13]
            notmet_bar: [9, 4, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Assessment Quality Watchlist"
            slot: 1
            of: 2
          - id: page_subtitle
            region: header
            kind: textbox
            text: "Programs with 20 or more scored PLO results and no Not Met outcomes"
            slot: 2
            of: 2
          - id: data_as_of
            region: data_as_of
            kind: cardVisual
            field_bindings: Outcome Results[Data As Of]
            insight_basis: "Data recency"
            color_strategy: none
          - id: school_slicer
            region: rail
            kind: slicer
            field_bindings: Course[School]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: academic_year_slicer
            region: rail
            kind: slicer
            field_bindings: Date[Academic Year]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: kpi_programs_on_watchlist
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Programs on Watchlist]
            purpose: "How many programs have 20+ scored PLO results and zero Not Met?"
            color_strategy: measure_match
            slot: 1
            of: 3
          - id: kpi_plo_not_met_rate
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[Not Met Rate]
            display_label: "PLO Not Met Rate"
            purpose: "What is the PLO Not Met rate overall (benchmark for the table)?"
            comparison_basis: "All PLO results under current slicers (page filter Outcome Type = PLO)"
            color_strategy: measure_match
            slot: 2
            of: 3
          - id: kpi_all_outcomes_not_met_rate
            region: kpis
            kind: cardVisual
            field_bindings: Outcome Results[All Outcomes Not Met Rate]
            display_label: "All Outcomes Not Met Rate"
            purpose: "What is the Not Met rate across every outcome type (ignoring the page's PLO filter)?"
            comparison_basis: "All outcome types under current School/Academic Year slicers"
            color_strategy: measure_match
            slot: 3
            of: 3
          - id: explainer
            region: explainer
            kind: textbox
            text: "A 0% Not Met rate across 20 or more scored results usually means the assessment or rubric cannot distinguish performance levels (for example, every criterion is scored at or above mastery by design), not that every student mastered the outcome. Review the rubric before reporting these results."
            insight_basis: "Interprets the watchlist rule so readers do not treat 0% Not Met as success."
          - id: watchlist_table
            region: watchlist
            kind: tableEx
            purpose: "Which program x school combinations meet the watchlist rule, and on how much evidence?"
            field_bindings: [Learning Outcome[Program], Course[School], Outcome Results[Scored Results], Outcome Results[Pct at Mastery (LLU)], Outcome Results[Not Met Rate], Outcome Results[Assessed Students]]
            visual_filters: [ "Outcome Results[Watchlist Flag] = 1" ]
            sort_policy: value_desc
            sort_field: Outcome Results[Scored Results]
            color_strategy: none
          - id: notmet_by_school
            region: notmet_bar
            kind: barChart
            purpose: "How does the Not Met rate vary by school?"
            field_bindings: { Category: Course[School], Y: Outcome Results[Not Met Rate] }
            sort_policy: value_desc
            color_strategy: measure_match
        space_audit:
          content_cell_count: 110
          placed_cell_count: 110
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: watchlist, pct_of_content: 49 }
          balance_rationale: "Operational variant B: the watchlist table is the action queue (hero, 6 x 9); the 4 x 9 school bar keeps ~10 school labels readable."
  interaction_pattern:
    drill_targets: [ "Program Drill-Down (drillthrough field Course[School], from Institution Overview mastery_by_school)" ]
    cross_filter_rules: "Default Filter between all visuals on each page; slicers filter all visuals; no Highlight overrides."
  accessibility:
    alt_text_strategy: "headline+trend: each chart's alt text states the question it answers and the measure/category it plots"
    contrast_notes: "Ice blue #8FCBEB (contrast 1.8:1 on white) is never used for text; gold #C8952A (2.9:1) only for bars/rules/accent strips; all text is navy #0B2545 on white or white on navy."
  theme:
    base: "references/design/assets/base.json adapted (LLU-Outcomes custom theme: palette, Cambria/Calibri text classes, navy rail styling)"
    user_overrides: "Palette and fonts fixed by the user; do not substitute."
```

## Implementation notes
- **Order of work:**
  1. Install the CLI.
  2. Add the `Data As Of` measure and unhide Scored Results, export TMDL, commit.
  3. Create the theme and replace the default "Page 1".
  4. Build Page 1, then 2, then 3, validating, reloading and taking screenshots each time. After each page renders cleanly, commit with a BUILD_LOG.md entry.
  5. Add `Watchlist Flag` and `Programs on Watchlist`, export TMDL, then build Page 4 and commit.
  6. Save all four screenshots to `screenshots/*.png` and commit.
- **Model changes:** through the powerbi-modeling-mcp server against the open Desktop model, exported to the PBIP folder and committed before any Desktop reload.
- **PBIR/report authoring:** `powerbi-report-author` CLI metadata and validation; PBIR files under `canvas-outcomes.Report/definition`.
- **Validation:** CLI PBIR validation for each page, Desktop reload, and a screenshot review for each page.
- **Publishing boundary:** local only.
- **Risks:**
  - Desktop has reverted MCP-only model changes once before. Mitigation: export and commit right after each model change, and never use Close & Apply in Power Query during the build.
  - Page 3 will be visually empty by design.
  - The watchlist depends on the Program naming split (a department-rule name vs the register name for the same program).
