#!/usr/bin/env node
// Deterministic PBIR generator for the canvas-outcomes-synthetic report.
// Implements the approved Design Brief in _brief/report-spec.md.
//
// Usage: node tools/build_report.js <pageCount 1-4>
//   Rebuilds pages 1..N (the generator owns every page under definition/pages),
//   writes the LLU-Outcomes theme and registers it in report.json.
//
// IDs are stable hashes of logical keys, so re-running produces identical files.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPORT = path.resolve(__dirname, '..', 'canvas-outcomes-synthetic.Report');
const DEF = path.join(REPORT, 'definition');
const PAGES_DIR = path.join(DEF, 'pages');
const RR_DIR = path.join(REPORT, 'StaticResources', 'RegisteredResources');

const SCHEMA = {
  page: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
  pages: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json',
  visual: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json',
};

// ---------- palette & type ----------
const NAVY = '#0B2545';
const ICE = '#8FCBEB';
const GOLD = '#C8952A';
const STEEL = '#5C7A99';
const INK = '#1F2D3D';
const MUTED = '#3E5468';
const LINE = '#D9E2EC';
const WHITE = '#FFFFFF';
const ICE_TINT = '#E8F5FB';
const GOLD_TINT = '#F6EAD3';
const HEAD = 'Cambria';
const BODY = 'Calibri';

const OR = 'Outcome Results';
const LO = 'Learning Outcome';
const COURSE = 'Course';
const DATE = 'Date';

// ---------- helpers ----------
const hash = (s, n) => crypto.createHash('sha1').update(s).digest('hex').slice(0, n);
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${String(s).replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const bool = (b) => lit(b ? 'true' : 'false');
const color = (hex) => ({ solid: { color: str(hex) } });
const col = (t, c) => ({ Column: { Expression: { SourceRef: { Entity: t } }, Property: c } });
const meas = (t, m) => ({ Measure: { Expression: { SourceRef: { Entity: t } }, Property: m } });
const proj = (field, extra = {}) => {
  const k = field.Column || field.Measure;
  const t = k.Expression.SourceRef.Entity;
  return { field, queryRef: `${t}.${k.Property}`, nativeQueryRef: k.Property, ...extra };
};
const pad = (t, r = t, b = t, l = r) => [{ properties: { top: num(t), right: num(r), bottom: num(b), left: num(l) } }];
const off = [{ properties: { show: bool(false) } }];
const alt = (text) => [{ properties: { altText: str(text) } }];
const title = (text) => [{
  properties: {
    show: bool(true), text: str(text), fontFamily: str(BODY), fontSize: num(15),
    bold: bool(true), fontColor: color(NAVY), alignment: str('left'),
  },
}];
const card_frame = {
  background: [{ properties: { show: bool(true), color: color(WHITE), transparency: num(0) } }],
  border: [{ properties: { show: bool(true), color: color(LINE), radius: num(8), width: num(1) } }],
  padding: pad(8),
};
const inFilter = (alias, entity, column, values) => ({
  Version: 2,
  From: [{ Name: alias, Entity: entity, Type: 0 }],
  Where: [{
    Condition: {
      In: {
        Expressions: [{ Column: { Expression: { SourceRef: { Source: alias } }, Property: column } }],
        Values: values.map((v) => [{ Literal: { Value: `'${v}'` } }]),
      },
    },
  }],
});

// ---------- visual builders ----------
function visual(pageKey, key, pos, body, extra = {}) {
  return {
    $schema: SCHEMA.visual,
    name: hash(`${pageKey}:${key}`, 20),
    position: { x: pos.x, y: pos.y, z: pos.z, height: pos.h, width: pos.w, tabOrder: pos.z },
    visual: body,
    ...extra,
  };
}

function textbox(text, { font = BODY, size = '12pt', clr = INK, bold = false, bg = null, padding = 0, align = 'left' } = {}) {
  const style = { fontFamily: font, fontSize: size, color: clr };
  if (bold) style.fontWeight = 'bold';
  const vco = { padding: pad(padding), border: off };
  vco.background = bg
    ? [{ properties: { show: bool(true), color: color(bg), transparency: num(0) } }]
    : off;
  return {
    visualType: 'textbox',
    objects: {
      general: [{ properties: { paragraphs: [{ textRuns: [{ value: text, textStyle: style }], horizontalTextAlignment: align }] } }],
    },
    visualContainerObjects: vco,
  };
}

function rect(fill, radius = 0) {
  return {
    visualType: 'shape',
    objects: {
      shape: [{ properties: { tileShape: str(radius ? 'rectangleRounded' : 'rectangle'), ...(radius ? { roundEdge: int(radius) } : {}) } }],
      fill: [{ properties: { fillColor: color(fill), transparency: num(0) }, selector: { id: 'default' } }],
      outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
    },
    visualContainerObjects: { background: off, border: off, padding: pad(0) },
  };
}

// Single-value KPI card. Canvas 1080: value 32pt, label 15pt -> content min ~104px -> h=KPI_H (112).
function kpiCard(measure, label, accent, altText) {
  return {
    visualType: 'cardVisual',
    query: { queryState: { Data: { projections: [proj(meas(OR, measure))] } } },
    objects: {
      value: [{ properties: { fontSize: num(32), fontFamily: str(HEAD), fontColor: color(NAVY), bold: bool(true) }, selector: { id: 'default' } }],
      label: [{ properties: { show: bool(true), text: str(label), fontSize: num(15), fontFamily: str(BODY), fontColor: color(MUTED) }, selector: { id: 'default' } }],
      padding: [{ properties: { paddingUniform: num(8) }, selector: { id: 'default' } }],
      layout: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }],
      outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
      accentBar: [{ properties: { show: bool(true), position: str('Left'), width: num(6), color: color(accent) }, selector: { id: 'default' } }],
    },
    visualContainerObjects: {
      ...card_frame,
      title: off,
      spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: 'default' } }],
      general: alt(altText),
    },
  };
}

function dataAsOfCard() {
  return {
    visualType: 'cardVisual',
    query: { queryState: { Data: { projections: [proj(meas(OR, 'Data As Of'))] } } },
    objects: {
      value: [{ properties: { fontSize: num(12), fontFamily: str(BODY), fontColor: color(MUTED), bold: bool(false), horizontalAlignment: str('right') }, selector: { id: 'default' } }],
      label: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
      padding: [{ properties: { paddingUniform: num(4) }, selector: { id: 'default' } }],
      layout: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }],
      outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
    },
    visualContainerObjects: {
      background: off, border: off, title: off, padding: pad(0),
      general: alt('Date of the most recent outcome result in the model'),
    },
  };
}

function slicer(entity, column, headerText, mode, selected = null) {
  const objects = {
    data: [{ properties: { mode: str(mode) } }],
    header: [{ properties: { show: bool(true), text: str(headerText), fontFamily: str(BODY), textSize: num(13), bold: bool(true), fontColor: color(WHITE) } }],
    items: [{ properties: { fontFamily: str(BODY), textSize: num(13), fontColor: color(WHITE), background: color(NAVY), padding: num(2) } }],
    // Selected checkbox fill: gold so it reads against the navy rail (the default is near-black).
    selectionIcon: [{ properties: { color: color(GOLD) } }],
  };
  if (selected) {
    objects.general = [{ properties: { filter: { filter: inFilter('s', entity, column, selected) } } }];
  }
  return {
    visualType: 'slicer',
    query: { queryState: { Values: { projections: [proj(col(entity, column))] } } },
    objects,
    visualContainerObjects: {
      background: off, border: off, title: off, padding: pad(8),
      general: alt(`Filter by ${headerText}`),
    },
  };
}

function barChart(category, measure, fill, chartTitle, altText, { showAll = false, axisFont = 13 } = {}) {
  const cat = { projections: [proj(category)] };
  if (showAll) cat.showAll = true;
  return {
    visualType: 'barChart',
    query: {
      queryState: { Category: cat, Y: { projections: [proj(meas(OR, measure))] } },
      sortDefinition: { sort: [{ field: meas(OR, measure), direction: 'Descending' }], isDefaultSort: true },
    },
    objects: {
      dataPoint: [{ properties: { defaultColor: color(fill) } }],
      labels: [{ properties: { show: bool(true), fontSize: num(12), fontFamily: str(BODY), color: color(INK) } }],
      categoryAxis: [{ properties: { show: bool(true), fontSize: num(axisFont), fontFamily: str(BODY), labelColor: color(INK), showAxisTitle: bool(false), maxMarginFactor: int(50) } }],
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false) } }],
    },
    visualContainerObjects: { ...card_frame, title: title(chartTitle), general: alt(altText) },
  };
}

function lineChart(category, measure, fill, chartTitle, altText) {
  return {
    visualType: 'lineChart',
    query: {
      queryState: { Category: { projections: [proj(category)] }, Y: { projections: [proj(meas(OR, measure))] } },
      sortDefinition: { sort: [{ field: category, direction: 'Ascending' }], isDefaultSort: true },
    },
    objects: {
      dataPoint: [{ properties: { defaultColor: color(fill) } }],
      labels: [{ properties: { show: bool(true), fontSize: num(12), fontFamily: str(BODY), color: color(INK) } }],
      categoryAxis: [{ properties: { show: bool(true), fontSize: num(13), fontFamily: str(BODY), labelColor: color(INK), showAxisTitle: bool(false) } }],
      valueAxis: [{ properties: { show: bool(true), fontSize: num(12), labelColor: color(MUTED), showAxisTitle: bool(false) } }],
    },
    visualContainerObjects: { ...card_frame, title: title(chartTitle), general: alt(altText) },
  };
}

function tableStyle(rowHeaders = false) {
  const o = {
    columnHeaders: [{ properties: {
      backColor: color(NAVY), fontColor: color(WHITE), bold: bool(true), fontFamily: str(BODY), fontSize: num(12),
      autoSizeColumnWidth: bool(true), columnAdjustment: str('growToFit'), wordWrap: bool(true),
    } }],
    values: [{ properties: {
      backColorPrimary: color(WHITE), backColorSecondary: color('#F4F7FA'),
      fontColorPrimary: color(INK), fontColorSecondary: color(INK), fontFamily: str(BODY), fontSize: num(12), wordWrap: bool(true),
    } }],
  };
  if (rowHeaders) {
    o.rowHeaders = [{ properties: { fontColor: color(INK), fontFamily: str(BODY), fontSize: num(12), wordWrap: bool(true) } }];
  }
  return o;
}

function matrix(rows, columns, values, chartTitle, altText, { showAllRows = false, rowWidth = 0, valueWidth = 0 } = {}) {
  const r = { projections: [proj(rows)] };
  if (showAllRows) r.showAll = true;
  const objects = tableStyle(true);
  if (rowWidth) {
    // Long outcome titles make grow-to-fit push every value column off-screen,
    // so pin widths and drop the per-year total columns.
    Object.assign(objects.columnHeaders[0].properties, { autoSizeColumnWidth: bool(false), columnAdjustment: str('fixedWidth') });
    objects.columnWidth = [
      { properties: { value: num(rowWidth) }, selector: { metadata: proj(rows).queryRef } },
      ...values.map((m) => ({ properties: { value: num(valueWidth) }, selector: { metadata: proj(meas(OR, m)).queryRef } })),
    ];
    objects.subTotals = [{ properties: { columnSubtotals: bool(false) } }];
  }
  return {
    visualType: 'pivotTable',
    query: {
      queryState: {
        Rows: r,
        Columns: { projections: [proj(columns)] },
        Values: { projections: values.map((m) => proj(meas(OR, m))) },
      },
    },
    objects,
    visualContainerObjects: {
      ...card_frame, title: title(chartTitle), general: alt(altText),
      stylePreset: [{ properties: { name: str('None') } }],
    },
  };
}

function table(fields, sortMeasure, chartTitle, altText, filterConfig = null, widths = null) {
  const objects = tableStyle(false);
  if (widths) {
    // Fixed widths (summing to less than the inner width) keep every column on the visual; long text wraps.
    Object.assign(objects.columnHeaders[0].properties, { autoSizeColumnWidth: bool(false), columnAdjustment: str('fixedWidth') });
    objects.columnWidth = fields.map((f, i) => ({ properties: { value: num(widths[i]) }, selector: { metadata: proj(f).queryRef } }));
  }
  const v = {
    visualType: 'tableEx',
    query: {
      queryState: { Values: { projections: fields.map((f) => proj(f)) } },
      sortDefinition: { sort: [{ field: meas(OR, sortMeasure), direction: 'Descending' }], isDefaultSort: true },
    },
    objects,
    visualContainerObjects: {
      ...card_frame, title: title(chartTitle), general: alt(altText),
      stylePreset: [{ properties: { name: str('None') } }],
    },
  };
  return { body: v, filterConfig };
}

function backButton(label) {
  return {
    visualType: 'actionButton',
    objects: {
      text: [
        { properties: { show: bool(true) } },
        { properties: { text: str(label), fontFamily: str(BODY), fontSize: num(13), bold: bool(true), fontColor: color(NAVY), horizontalAlignment: str('center') }, selector: { id: 'default' } },
      ],
      icon: [
        { properties: { show: bool(false) } },
        { properties: { shapeType: str('back'), placement: str('left') }, selector: { id: 'default' } },
      ],
      fill: [
        { properties: { show: bool(true) } },
        { properties: { fillColor: color(GOLD), transparency: num(0) }, selector: { id: 'default' } },
        { properties: { fillColor: color('#E3C27F') }, selector: { id: 'hover' } },
      ],
      outline: [{ properties: { show: bool(false) } }],
      shape: [
        { properties: { tileShape: str('rectangleRounded'), roundEdge: int(6) } },
        { properties: { tileShape: str('rectangleRounded') }, selector: { id: 'default' } },
      ],
    },
    visualContainerObjects: {
      background: off, border: off, padding: pad(0),
      visualLink: [{ properties: { show: bool(true), type: str('Back'), tooltip: str('Return to the page you drilled through from') } }],
      general: alt('Back button: returns to Institution Overview'),
    },
    drillFilterOtherVisuals: true,
  };
}

// ---------- layout constants (1920 x 1080) ----------
const CX = 320;       // content left (rail 32..296 + 24 gutter)
const CW = 1568;      // content width (to 1888)
const CY = 136;       // content top (below 112px header band + 24)
const CB = 1048;      // content bottom (1080 - 32)
const RAIL = { x: 32, y: CY, w: 264, h: CB - CY };
const RAIL_IN = { x: 48, w: 232 };
const KPI_H = 112;              // KPI card row height
const MAIN_Y = CY + KPI_H + 24; // main visuals start below the KPI row (272)
const MAIN_H = CB - MAIN_Y;     // 776

function chrome(pageKey, pageTitle, subtitle) {
  return [
    visual(pageKey, 'page_title', { x: 32, y: 24, w: 1300, h: 56, z: 1000 },
      textbox(pageTitle, { font: HEAD, size: '26pt', clr: NAVY, bold: true })),
    visual(pageKey, 'page_subtitle', { x: 32, y: 76, w: 1300, h: 32, z: 2000 },
      textbox(subtitle, { font: BODY, size: '14pt', clr: MUTED })),
    visual(pageKey, 'gold_rule', { x: 32, y: 112, w: 96, h: 4, z: 3000 }, rect(GOLD)),
    visual(pageKey, 'data_as_of', { x: 1488, y: 32, w: 400, h: 40, z: 4000 }, dataAsOfCard()),
    visual(pageKey, 'rail', { ...RAIL, z: 0 }, rect(NAVY)),
  ];
}

const DROPDOWN_H = 96;  // 60 chrome + 8/8 padding + 13pt header, snapped
const LIST5_H = 248;    // 16 padding + 40 header + 5 x 36 rows (13pt) + 12 safety, snapped

// ---------- pages ----------
function page1() {
  const k = 'institution-overview';
  const yearSlicer = visual(k, 'academic_year_slicer', { x: RAIL_IN.x, y: CY + 16 + LIST5_H + 16, w: RAIL_IN.w, h: DROPDOWN_H, z: 6000 },
    slicer(DATE, 'Academic Year', 'Academic Year', 'Dropdown', ['2025-26']));
  const trend = visual(k, 'mastery_trend', { x: 1116, y: MAIN_Y, w: 772, h: MAIN_H, z: 12000 },
    lineChart(col(DATE, 'Academic Year'), 'Pct at Mastery (LLU)', NAVY, 'Mastery Rate by Academic Year',
      'Line chart of the share of scored results at or above the LLU 0.75 mastery standard for each academic year; ignores the Academic Year slicer so the full trend stays visible.'));
  const visuals = [
    ...chrome(k, 'Institution Overview', 'Outcome mastery across the university'),
    visual(k, 'outcome_type_slicer', { x: RAIL_IN.x, y: CY + 16, w: RAIL_IN.w, h: LIST5_H, z: 5000 },
      slicer(LO, 'Outcome Type', 'Outcome Type', 'Basic', ['PLO'])),
    yearSlicer,
    visual(k, 'kpi_assessed_students', { x: 320, y: CY, w: 374, h: KPI_H, z: 7000 },
      kpiCard('Assessed Students', 'Assessed Students', STEEL, 'Card: distinct students with an outcome result')),
    visual(k, 'kpi_pct_mastery', { x: 718, y: CY, w: 374, h: KPI_H, z: 8000 },
      kpiCard('Pct at Mastery (LLU)', 'Pct at Mastery (LLU 0.75)', NAVY, 'Card: share of scored results at or above the LLU 0.75 mastery standard')),
    visual(k, 'kpi_coverage', { x: 1116, y: CY, w: 374, h: KPI_H, z: 9000 },
      kpiCard('Coverage', 'Coverage', ICE, 'Card: share of outcomes in scope with at least one result')),
    visual(k, 'kpi_yoy', { x: 1514, y: CY, w: 374, h: KPI_H, z: 10000 },
      kpiCard('Pct at Mastery YoY', 'Mastery vs Prior Year', GOLD, 'Card: change in mastery rate versus the prior academic year, in percentage points')),
    visual(k, 'mastery_by_school', { x: 320, y: MAIN_Y, w: 772, h: MAIN_H, z: 11000 },
      barChart(col(COURSE, 'School'), 'Pct at Mastery (LLU)', NAVY, 'Mastery Rate by School (right-click a bar to drill through)',
        'Bar chart of mastery rate by school, sorted highest to lowest. Right-click a school to drill through to Program Drill-Down.')),
    trend,
  ];
  return {
    key: k, displayName: 'Institution Overview', visuals,
    visualInteractions: [{ source: yearSlicer.name, target: trend.name, type: 'NoFilter' }],
  };
}

function page2() {
  const k = 'program-drill-down';
  const fPlo = 'Filter' + hash(`${k}:filter:plo`, 24);
  const fDt = 'Filter' + hash(`${k}:filter:drillthrough-school`, 24);
  // Program is not blank: hides PLOs with no resolved program from the program bar.
  const programNotBlank = {
    filters: [{
      name: 'Filter' + hash(`${k}:filter:program-not-blank`, 24), field: col(LO, 'Program'), type: 'Advanced',
      filter: {
        Version: 2,
        From: [{ Name: 'l', Entity: LO, Type: 0 }],
        Where: [{ Condition: { Not: { Expression: { Comparison: { ComparisonKind: 0,
          Left: { Column: { Expression: { SourceRef: { Source: 'l' } }, Property: 'Program' } },
          Right: { Literal: { Value: 'null' } } } } } } }],
      },
      howCreated: 'User', isHiddenInViewMode: false,
    }],
  };
  const visuals = [
    ...chrome(k, 'Program Drill-Down', 'Program learning outcomes by year'),
    visual(k, 'school_slicer', { x: RAIL_IN.x, y: CY + 16, w: RAIL_IN.w, h: DROPDOWN_H, z: 5000 },
      slicer(COURSE, 'School', 'School', 'Dropdown')),
    visual(k, 'program_slicer', { x: RAIL_IN.x, y: CY + 16 + DROPDOWN_H + 16, w: RAIL_IN.w, h: DROPDOWN_H, z: 6000 },
      slicer(LO, 'Program', 'Program', 'Dropdown')),
    visual(k, 'back_button', { x: RAIL_IN.x, y: CB - 16 - 48, w: RAIL_IN.w, h: 48, z: 7000 },
      backButton('Back to Overview')),
    visual(k, 'outcome_year_matrix', { x: 320, y: CY, w: 960, h: 912, z: 8000 },
      matrix(col(LO, 'Outcome Title'), col(DATE, 'Academic Year'), ['Pct at Mastery (LLU)', 'Scored Results'],
        'PLO Mastery by Academic Year',
        'Matrix of each program learning outcome by academic year, showing mastery rate and number of scored results.',
        { rowWidth: 240, valueWidth: 68 })),
    visual(k, 'students_by_program', { x: 1304, y: CY, w: 584, h: 480, z: 9000 },
      barChart(col(LO, 'Program'), 'Assessed Students', STEEL, 'Assessed Students by Program',
        'Bar chart of distinct assessed students by program, sorted highest to lowest.', { axisFont: 10 }),
      { filterConfig: programNotBlank }),
  ];
  const t = table([col(LO, 'Program'), col(LO, 'Program Source'), meas(OR, 'Scored Results')], 'Scored Results',
    'How Each Program Was Assigned', 'Table of programs with the rule that assigned them and their scored result counts.',
    null, [280, 170, 90]);
  visuals.push(visual(k, 'program_mapping', { x: 1304, y: 640, w: 584, h: 408, z: 10000 }, t.body));
  return {
    key: k, displayName: 'Program Drill-Down', visuals,
    filterConfig: {
      filters: [
        {
          name: fDt, field: col(COURSE, 'School'), type: 'Categorical', howCreated: 'Drillthrough',
        },
        {
          name: fPlo, field: col(LO, 'Outcome Type'), type: 'Categorical',
          filter: inFilter('l', LO, 'Outcome Type', ['PLO']), howCreated: 'User', isLockedInViewMode: true,
        },
      ],
    },
    pageBinding: {
      name: 'Pod', type: 'Drillthrough',
      parameters: [{ name: 'Param_' + fDt, boundFilter: fDt, fieldExpr: col(COURSE, 'School') }],
    },
  };
}

function page3() {
  const k = 'core-values';
  const fCv = 'Filter' + hash(`${k}:filter:core-value`, 24);
  const visuals = [
    ...chrome(k, 'Core Values', "Mastery of LLU's seven core values (baseline)"),
    visual(k, 'school_slicer', { x: RAIL_IN.x, y: CY + 16, w: RAIL_IN.w, h: DROPDOWN_H, z: 5000 },
      slicer(COURSE, 'School', 'School', 'Dropdown')),
    visual(k, 'kpi_assessed_students', { x: 320, y: CY, w: 248, h: KPI_H, z: 6000 },
      kpiCard('Assessed Students', 'Assessed Students', STEEL, 'Card: distinct students with a core-value result')),
    visual(k, 'kpi_scored_results', { x: 592, y: CY, w: 248, h: KPI_H, z: 7000 },
      kpiCard('Scored Results', 'Scored Results', STEEL, 'Card: number of scored core-value results')),
    visual(k, 'baseline_note', { x: 864, y: CY, w: 1024, h: KPI_H, z: 8000 },
      textbox('Core-value outcomes were added to Canvas in 2026. This page shows the assessment baseline and will populate as programs align assessments to the LLU Values.',
        { font: BODY, size: '14pt', clr: NAVY, bg: ICE_TINT, padding: 16 })),
    visual(k, 'mastery_by_value', { x: 320, y: MAIN_Y, w: 520, h: MAIN_H, z: 9000 },
      barChart(col(LO, 'Outcome Title'), 'Pct at Mastery (LLU)', NAVY, 'Mastery Rate by Core Value',
        "Bar chart of mastery rate for each of LLU's seven core values; values with no results are still listed.", { showAll: true })),
    visual(k, 'value_by_school', { x: 864, y: MAIN_Y, w: 1024, h: MAIN_H, z: 10000 },
      // Fixed widths fit nine school columns (128 + 9 x 96 = 992 of 1008); school names wrap at word breaks.
      matrix(col(LO, 'Outcome Title'), col(COURSE, 'School'), ['Scored Results'], 'Scored Core-Value Results by School',
        'Matrix of scored core-value results by core value and school.', { showAllRows: true, rowWidth: 128, valueWidth: 96 })),
  ];
  return {
    key: k, displayName: 'Core Values', visuals,
    filterConfig: {
      filters: [{
        name: fCv, field: col(LO, 'Outcome Type'), type: 'Categorical',
        filter: inFilter('l', LO, 'Outcome Type', ['Core Value']), howCreated: 'User', isLockedInViewMode: true,
      }],
    },
  };
}

function page4() {
  const k = 'assessment-quality-watchlist';
  const fPlo = 'Filter' + hash(`${k}:filter:plo`, 24);
  const fWatch = 'Filter' + hash(`${k}:filter:watchlist`, 24);
  const watchFilter = {
    filters: [{
      name: fWatch, field: meas(OR, 'Watchlist Flag'), type: 'Advanced',
      filter: {
        Version: 2,
        From: [{ Name: 'o', Entity: OR, Type: 0 }],
        Where: [{ Condition: { Comparison: { ComparisonKind: 0, Left: { Measure: { Expression: { SourceRef: { Source: 'o' } }, Property: 'Watchlist Flag' } }, Right: { Literal: { Value: '1L' } } } } }],
      },
      howCreated: 'User', isHiddenInViewMode: false,
    }],
  };
  const t = table(
    [col(LO, 'Program'), col(COURSE, 'School'), meas(OR, 'Scored Results'), meas(OR, 'Pct at Mastery (LLU)'), meas(OR, 'Not Met Rate'), meas(OR, 'Assessed Students')],
    'Scored Results', 'Watchlist: 20+ Scored PLO Results and 0% Not Met',
    'Table of program and school combinations with at least 20 scored PLO results and no results below the mastery standard, sorted by scored results.',
    watchFilter, [300, 200, 100, 120, 90, 100]);
  const visuals = [
    ...chrome(k, 'Assessment Quality Watchlist', 'Programs with 20 or more scored PLO results and no Not Met outcomes'),
    visual(k, 'school_slicer', { x: RAIL_IN.x, y: CY + 16, w: RAIL_IN.w, h: DROPDOWN_H, z: 5000 },
      slicer(COURSE, 'School', 'School', 'Dropdown')),
    visual(k, 'academic_year_slicer', { x: RAIL_IN.x, y: CY + 16 + DROPDOWN_H + 16, w: RAIL_IN.w, h: DROPDOWN_H, z: 6000 },
      slicer(DATE, 'Academic Year', 'Academic Year', 'Dropdown')),
    visual(k, 'kpi_programs_on_watchlist', { x: 320, y: CY, w: 290, h: KPI_H, z: 7000 },
      kpiCard('Programs on Watchlist', 'Programs on Watchlist', GOLD, 'Card: number of programs with 20 or more scored PLO results and a 0% Not Met rate')),
    visual(k, 'kpi_plo_not_met_rate', { x: 634, y: CY, w: 290, h: KPI_H, z: 8000 },
      kpiCard('Not Met Rate', 'PLO Not Met Rate', GOLD, 'Card: share of scored PLO results below the LLU mastery standard')),
    visual(k, 'kpi_all_outcomes_not_met_rate', { x: 948, y: CY, w: 290, h: KPI_H, z: 9000 },
      kpiCard('All Outcomes Not Met Rate', 'All Outcomes Not Met Rate', GOLD, 'Card: share of scored results of every outcome type below the LLU mastery standard')),
    visual(k, 'explainer', { x: 1262, y: CY, w: 626, h: KPI_H, z: 10000 },
      textbox('A 0% Not Met rate across 20 or more scored results usually means the assessment or rubric cannot distinguish performance levels, not that every student mastered the outcome. Review the rubric before reporting these results.',
        { font: BODY, size: '12pt', clr: NAVY, bg: GOLD_TINT, padding: 12 })),
    visual(k, 'watchlist_table', { x: 320, y: MAIN_Y, w: 944, h: MAIN_H, z: 11000 }, t.body, { filterConfig: t.filterConfig }),
    visual(k, 'notmet_by_school', { x: 1288, y: MAIN_Y, w: 600, h: MAIN_H, z: 12000 },
      barChart(col(COURSE, 'School'), 'Not Met Rate', GOLD, 'PLO Not Met Rate by School',
        'Bar chart of the share of scored PLO results below the mastery standard by school, sorted highest to lowest.')),
  ];
  return {
    key: k, displayName: 'Assessment Quality Watchlist', visuals,
    filterConfig: {
      filters: [{
        name: fPlo, field: col(LO, 'Outcome Type'), type: 'Categorical',
        filter: inFilter('l', LO, 'Outcome Type', ['PLO']), howCreated: 'User', isLockedInViewMode: true,
      }],
    },
  };
}

// ---------- theme ----------
function theme() {
  const t = {
    $schema: 'https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.153.json',
    name: '__NAME__',
    dataColors: [NAVY, ICE, GOLD, STEEL, '#13315C', '#B8D8EE', '#E3C27F', '#7F8C9A'],
    good: '#2E7D4F', neutral: GOLD, bad: '#B23A3A',
    maximum: NAVY, center: ICE, minimum: '#E8F5FB', null: '#7F8C9A',
    foreground: INK, background: WHITE, tableAccent: NAVY,
    textClasses: {
      callout: { fontSize: 32, fontFace: HEAD, color: NAVY },
      title: { fontSize: 15, fontFace: BODY, color: NAVY },
      header: { fontSize: 14, fontFace: HEAD, color: NAVY },
      label: { fontSize: 12, fontFace: BODY, color: INK },
    },
    visualStyles: {
      '*': { '*': {
        border: [{ show: true, color: { solid: { color: LINE } }, radius: 8 }],
        dropShadow: [{ show: false }],
        padding: [{ top: 8, bottom: 8, left: 8, right: 8 }],
        title: [{ fontFamily: BODY, fontSize: 15, bold: true, fontColor: { solid: { color: NAVY } } }],
        categoryAxis: [{ gridlineStyle: 'dotted', gridlineColor: { solid: { color: '#EEF2F6' } } }],
        valueAxis: [{ gridlineStyle: 'dotted', gridlineColor: { solid: { color: '#EEF2F6' } } }],
      } },
      page: { '*': { background: [{ color: { solid: { color: WHITE } }, transparency: 0 }] } },
      tableEx: { '*': { columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: 'growToFit' }] } },
      pivotTable: { '*': { columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: 'growToFit' }] } },
      cardVisual: { '*': {
        value: [{ bold: true, $id: 'default' }],
        label: [{ show: true, $id: 'default' }],
        cardCalloutArea: [{ paddingUniform: 0 }],
        title: [{ show: false }],
      } },
      textbox: { '*': { padding: [{ top: 0, bottom: 0, left: 0, right: 0 }], background: [{ show: false }], border: [{ show: false }] } },
      barChart: { '*': {
        labels: [{ show: true, fontSize: 12 }],
        valueAxis: [{ show: false, gridlineShow: false, showAxisTitle: false }],
        categoryAxis: [{ show: true, fontSize: 13, showAxisTitle: false, innerPadding: 20, gridlineShow: false }],
        dataPoint: [{ borderShow: false }],
        legend: [{ show: false }],
      } },
      lineChart: { '*': {
        lineStyles: [{ strokeWidth: 3, lineChartType: 'linear', areaShow: false }],
        dataPoint: [{ transparency: 85 }],
        labels: [{ show: true, labelPosition: 'Above', fontSize: 12, color: { solid: { color: INK } }, labelDensity: 100 }],
        legend: [{ show: false }],
      } },
      slicer: { '*': {
        header: [{ fontFamily: BODY, textSize: 13, outlineStyle: 0 }],
        items: [{ fontFamily: BODY, textSize: 13, outlineStyle: 0, padding: 2 }],
      } },
    },
  };
  const body = JSON.stringify(t, null, 2);
  const name = `LLU-Outcomes-${hash(body, 8)}.json`;
  return { name, json: body.replace('"__NAME__"', JSON.stringify(name)) };
}

// ---------- write ----------
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function main() {
  const n = Number(process.argv[2] || '1');
  if (!(n >= 1 && n <= 4)) throw new Error('pageCount must be 1-4');
  const builders = [page1, page2, page3, page4].slice(0, n);
  const pages = builders.map((b) => b());

  // Theme: remove previous generated theme files, write the new one, register it.
  const th = theme();
  fs.mkdirSync(RR_DIR, { recursive: true });
  for (const f of fs.readdirSync(RR_DIR)) if (/^LLU-Outcomes-[0-9a-f]{8}\.json$/.test(f)) fs.unlinkSync(path.join(RR_DIR, f));
  fs.writeFileSync(path.join(RR_DIR, th.name), th.json + '\n', 'utf8');

  const reportFile = path.join(DEF, 'report.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  report.themeCollection.customTheme = {
    name: th.name,
    reportVersionAtImport: report.themeCollection.baseTheme.reportVersionAtImport,
    type: 'RegisteredResources',
  };
  report.resourcePackages = report.resourcePackages.filter((p) => p.type !== 'RegisteredResources');
  report.resourcePackages.push({ name: 'RegisteredResources', type: 'RegisteredResources', items: [{ name: th.name, path: th.name, type: 'CustomTheme' }] });
  writeJson(reportFile, report);

  // Pages: the generator owns every page directory.
  for (const d of fs.readdirSync(PAGES_DIR)) {
    const full = path.join(PAGES_DIR, d);
    if (fs.statSync(full).isDirectory()) fs.rmSync(full, { recursive: true, force: true });
  }
  const pageOrder = [];
  for (const p of pages) {
    const id = hash(`page:${p.key}`, 20);
    pageOrder.push(id);
    const pageJson = {
      $schema: SCHEMA.page, name: id, displayName: p.displayName, displayOption: 'FitToPage', height: 1080, width: 1920,
      objects: { background: [{ properties: { color: color(WHITE), transparency: num(0) } }] },
    };
    if (p.filterConfig) pageJson.filterConfig = p.filterConfig;
    if (p.pageBinding) pageJson.pageBinding = p.pageBinding;
    if (p.visualInteractions) pageJson.visualInteractions = p.visualInteractions;
    writeJson(path.join(PAGES_DIR, id, 'page.json'), pageJson);
    for (const v of p.visuals) writeJson(path.join(PAGES_DIR, id, 'visuals', v.name, 'visual.json'), v);
  }
  writeJson(path.join(PAGES_DIR, 'pages.json'), { $schema: SCHEMA.pages, pageOrder, activePageName: pageOrder[0] });
  console.log(JSON.stringify({ theme: th.name, pages: pages.map((p, i) => ({ id: pageOrder[i], name: p.displayName, visuals: p.visuals.length })) }, null, 2));
}

main();
