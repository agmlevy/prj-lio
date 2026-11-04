// Builds printable PDFs of the Unit 1, Day 1 packet from the canvas source.
// Usage: node print/build-day1.mjs [path/to/source.canvas.tsx]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src =
  process.argv[2] ??
  "/cursor/stores/user/canvases/5feafff2-8802-4502-b011-956e700c25c4/source.canvas.tsx";
const outDir = resolve(here, "pdf");
mkdirSync(outDir, { recursive: true });

const lines = readFileSync(src, "utf8").split("\n");
const start = lines.findIndex((l) => l.startsWith("const PASSAGE"));
const stop = lines.findIndex((l) => l.startsWith("function Passage("));
const domStart = lines.findIndex((l) => l.startsWith("const DOMAINS"));
const domStop = lines.findIndex((l) => l.startsWith("export default"));
const dataTs =
  [...lines.slice(start, stop), ...lines.slice(domStart, domStop)].join("\n") +
  "\nexport { PASSAGE, GRACIAN, ACT_READING, SAT, ACT_ENGLISH, GRE_TC1, GRE_TC2, GRE_SE, GRE_RC, FAST, DOMAINS };\n";
const tmpTs = join(tmpdir(), `day1-data-${process.pid}.ts`);
writeFileSync(tmpTs, dataTs);
const D = await import(pathToFileURL(tmpTs).href);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rich = (s) =>
  esc(s)
    .split("__")
    .map((seg, i) => (i % 2 ? `<u>${seg}</u>` : seg))
    .join("")
    .split("\n")
    .map((l) => `<p>${l}</p>`)
    .join("");
const letterOf = (q, id) => q.letters[q.options.findIndex((o) => o.id === id)];

const SECTIONS = [
  {
    key: "actR",
    title: "Section 1: ACT Reading",
    pace: "10 questions · 10 minutes",
    directions:
      "The passage is followed by several questions. After reading the passage, choose the best answer to each question. You may refer to the passage as often as necessary.",
    items: D.ACT_READING,
  },
  {
    key: "sat",
    title: "Section 2: SAT Reading and Writing",
    pace: "10 questions · 12 minutes",
    directions:
      "The questions in this section address a number of important reading and writing skills. Each question includes one or more passages. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s). All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.",
    items: D.SAT,
  },
  {
    key: "actE",
    title: "Section 3: ACT English",
    pace: "3 questions · 2 minutes",
    directions:
      "In the passages that follow, certain words and phrases are underlined. For each question, choose the alternative you consider best. If you think the original version is best, choose NO CHANGE. Some questions ask about a section of the passage or the passage as a whole.",
    items: D.ACT_ENGLISH,
  },
  {
    key: "gre",
    title: "Section 4: GRE Verbal Reasoning",
    pace: "7 questions · 10 minutes",
    directions:
      "Each question type has its own directions, printed with the question. Text completion and sentence equivalence questions give no partial credit: every blank, or both choices, must be correct. Reading comprehension questions refer to the passage at the front of this booklet.",
    items: [D.GRE_TC1, D.GRE_TC2, ...D.GRE_SE, ...D.GRE_RC],
  },
  {
    key: "fast",
    title: "Section 5: FAST ELA Reading",
    pace: "4 items · 8 minutes",
    directions:
      "Answer the questions about the passage at the front of this booklet. Some questions have two parts: answer Part A first, then Part B. Some questions ask you to select more than one answer; select the number of answers the question asks for.",
    items: D.FAST,
  },
];

const isTwoBlank = (q) => Array.isArray(q.blanks);

function pickNote(q) {
  if (q.pick === 2) return `<div class="note">Select two answers.</div>`;
  if (q.pick === 0) return `<div class="note">Select all that apply.</div>`;
  return "";
}

function questionHtml(q) {
  if (isTwoBlank(q)) {
    const cols = q.blanks
      .map(
        (b) =>
          `<td><div class="blank-label">${esc(b.label)}</div>${b.options
            .map((o) => `<div class="tb-opt"><span class="box"></span>${esc(o.text)}</div>`)
            .join("")}</td>`,
      )
      .join("");
    return `<div class="q"><div class="qhead"><b>${esc(q.num)}.</b> <span class="skill">${esc(q.skill)}</span></div>
      <div class="qpassage">${rich(q.stem)}</div>
      <div class="stem">For each blank, select one entry from the corresponding column of choices. Fill all blanks in the way that best completes the text.</div>
      <table class="tb"><tr>${cols}</tr></table></div>`;
  }
  return `<div class="q"><div class="qhead"><b>${esc(q.num)}.</b> <span class="skill">${esc(q.skill)}</span></div>
    ${q.passageLabel ? `<div class="plabel">${esc(q.passageLabel)}</div>` : ""}
    ${q.passage ? `<div class="qpassage">${rich(q.passage)}</div>` : ""}
    <div class="stem">${esc(q.stem)}</div>${pickNote(q)}
    <ol class="opts">${q.options
      .map((o, i) => `<li><span class="L">${esc(q.letters[i])}.</span> ${esc(o.text)}</li>`)
      .join("")}</ol></div>`;
}

function answerSheet() {
  const rows = SECTIONS.map((s) => {
    const cells = s.items
      .map((q) => {
        if (isTwoBlank(q))
          return `<div class="as-item"><b>${esc(q.num)}</b> (i) ____ (ii) ____</div>`;
        const bubbles = q.letters.map((l) => `<span class="bub">${esc(l)}</span>`).join("");
        return `<div class="as-item"><b>${esc(q.num)}</b> ${bubbles}</div>`;
      })
      .join("");
    return `<h3>${esc(s.title)}</h3><div class="as-grid">${cells}</div>`;
  }).join("");
  return `<section class="page-break"><h2>Answer sheet</h2>
    <p class="muted">Fill in one bubble per question unless the question says to select two or select all that apply.</p>${rows}</section>`;
}

const css = `
@page { size: Letter; margin: 0.7in 0.75in; }
body { font-family: "Georgia", "Times New Roman", serif; font-size: 11pt; line-height: 1.45; color: #111; }
h1 { font-size: 20pt; margin: 0 0 6pt; } h2 { font-size: 15pt; margin: 14pt 0 6pt; border-bottom: 1px solid #999; padding-bottom: 3pt; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; }
p { margin: 0 0 5pt; } .muted { color: #555; font-size: 10pt; }
table { border-collapse: collapse; width: 100%; font-size: 10pt; }
th, td { border: 1px solid #aaa; padding: 4pt 6pt; vertical-align: top; text-align: left; }
th { background: #eee; }
.page-break { break-before: page; }
.para { display: grid; grid-template-columns: 22pt 1fr; gap: 6pt; margin-bottom: 6pt; }
.para .n { color: #666; font-size: 9pt; padding-top: 2pt; }
.directions { border: 1px solid #333; padding: 6pt 9pt; margin: 6pt 0 10pt; font-size: 10pt; }
.directions .pace { float: right; font-style: italic; }
.q { break-inside: avoid; margin: 0 0 12pt; }
.qhead { margin-bottom: 3pt; } .skill { font-size: 8.5pt; color: #555; text-transform: uppercase; letter-spacing: 0.4pt; }
.plabel { font-size: 9.5pt; font-style: italic; color: #444; margin-bottom: 3pt; }
.qpassage { border-left: 2px solid #999; padding-left: 9pt; margin: 3pt 0 6pt; }
.stem { font-weight: bold; margin-bottom: 3pt; } .note { font-size: 9.5pt; font-style: italic; margin-bottom: 3pt; }
ol.opts { list-style: none; padding-left: 12pt; margin: 0; } ol.opts li { margin-bottom: 2pt; }
.L { font-weight: bold; display: inline-block; width: 16pt; }
table.tb td { width: 50%; border: none; } .blank-label { font-size: 9pt; color: #555; margin-bottom: 3pt; }
.tb-opt { border: 1px solid #999; padding: 3pt 6pt; margin-bottom: 3pt; } .box { display: inline-block; width: 8pt; height: 8pt; border: 1px solid #333; margin-right: 6pt; }
.lines div { border-bottom: 1px solid #bbb; height: 24pt; }
.as-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt 18pt; }
.as-item { font-size: 10pt; } .as-item b { display: inline-block; width: 52pt; }
.bub { display: inline-block; width: 15pt; height: 15pt; line-height: 15pt; border: 1px solid #333; border-radius: 50%; text-align: center; font-size: 8pt; margin-right: 4pt; }
.key { break-inside: avoid; margin-bottom: 10pt; }
.key .ans { font-weight: bold; }
.key ul { margin: 3pt 0 0; padding-left: 16pt; font-size: 10pt; }
.source { border: 1px solid #999; padding: 6pt 9pt; margin-bottom: 8pt; font-size: 10pt; }
`;

const header = `<h1>Unit 1, Day 1: What Happens When You Stop Seeking Approval</h1>
<p>Selected Readings · ACT / SAT / GRE / FAST verbal practice</p>
<p>Name ______________________________ &nbsp; Date ______________ &nbsp; Start time ________ &nbsp; End time ________</p>`;

const contents = `<table><tr><th>Part</th><th>Format</th><th>Items</th><th>Time</th></tr>
<tr><td>Passage</td><td>Read once, closely. Mark the claim of each paragraph in the margin.</td><td>11 paragraphs</td><td>8 min</td></tr>
${SECTIONS.map((s) => `<tr><td>${esc(s.title.split(":")[0])}</td><td>${esc(s.title.split(": ")[1])}</td><td>${s.items.length}</td><td>${esc(s.pace.split("· ")[1])}</td></tr>`).join("")}
<tr><td>Section 5, continued</td><td>FAST Writing: text-based argumentative essay</td><td>1 essay</td><td>45 min</td></tr>
</table>`;

const passage = `<h2>The passage</h2>
<p class="muted">Adapted from the transcript of a video essay on the Bygone Philosophy channel. Paragraphs are numbered for reference.</p>
${D.PASSAGE.map((p, i) => `<div class="para"><span class="n">${i + 1}</span><span>${esc(p)}</span></div>`).join("")}`;

const sectionsHtml = SECTIONS.map(
  (s) => `<section class="page-break"><h2>${esc(s.title)}</h2>
  <div class="directions"><span class="pace">${esc(s.pace)}</span><b>Directions.</b> ${esc(s.directions)}</div>
  ${s.items.map(questionHtml).join("")}</section>`,
).join("");

const lined = (n) => `<div class="lines">${"<div></div>".repeat(n)}</div>`;

const writing = `<section class="page-break"><h2>Section 5, continued: FAST Writing</h2>
<div class="directions"><span class="pace">45 minutes</span><b>Prompt.</b> Some people believe a refusal should be short and unexplained. Others believe a refusal should come with a reason. Write an argumentative essay in which you take a position on whether people should explain their refusals. Use evidence from both sources to support your position. Address an opposing claim. Your essay should have an introduction, body paragraphs, and a conclusion, and should be written in a formal style.</div>
<div class="source"><b>Source 1:</b> the passage at the front of this booklet. Paragraphs 8, 9, and 10 bear most directly on refusing.</div>
<div class="source"><b>Source 2:</b> from "The Socially Intelligent"<br/>${esc(D.GRACIAN)}</div>
<h3>Planning space</h3>${lined(6)}
</section>
<section class="page-break"><h3>Essay</h3>${lined(28)}</section>
<section class="page-break">${lined(28)}</section>
<section class="page-break"><h2>FAST writing rubric (B.E.S.T.)</h2>
<p>Each domain is scored 1 to 4, for a total out of 12. A 4 meets the full description below. A 3 meets most of it, a 2 some of it, and a 1 little of it.</p>
<table><tr><th>Domain</th><th>What a 4 looks like</th><th>Score</th></tr>
${D.DOMAINS.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.four)}</td><td style="width:60pt">&nbsp;&nbsp;/ 4</td></tr>`).join("")}
<tr><td colspan="2"><b>Total</b></td><td>&nbsp;&nbsp;/ 12</td></tr></table>
<h2>Score report</h2>
<table><tr><th>Section</th><th>Correct</th><th>Skills missed</th></tr>
${SECTIONS.map((s) => `<tr><td>${esc(s.title.split(": ")[1])}</td><td style="width:70pt">&nbsp;&nbsp;&nbsp;&nbsp;/ ${s.items.length}</td><td></td></tr>`).join("")}
<tr><td>FAST Writing</td><td>&nbsp;&nbsp;&nbsp;&nbsp;/ 12</td><td></td></tr></table>
<p class="muted">For every miss, write the skill label printed on the question and the reason the wrong choice was tempting: too broad, too narrow, opposite, not stated, outside knowledge, or right word but wrong job.</p>
</section>`;

const booklet = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
${header}${contents}${passage}${sectionsHtml}${writing}${answerSheet()}</body></html>`;

function keyItem(q) {
  if (isTwoBlank(q)) {
    const ans = q.blanks
      .map((b) => `${b.label}: ${b.options.find((o) => o.id === b.answer).text}`)
      .join("; ");
    return `<div class="key"><div><b>${esc(q.num)}.</b> <span class="ans">${esc(ans)}</span> <span class="skill">${esc(q.skill)}</span></div>
      <p>${esc(q.explain)}</p><ul>${q.blanks
        .flatMap((b) => b.options)
        .map((o) => `<li><b>${esc(o.text)}.</b> ${esc(o.why)}</li>`)
        .join("")}</ul></div>`;
  }
  const ans = q.answer.map((id) => letterOf(q, id)).join(", ");
  return `<div class="key"><div><b>${esc(q.num)}.</b> <span class="ans">${esc(ans)}</span> <span class="skill">${esc(q.skill)}</span></div>
    <p>${esc(q.explain)}</p><ul>${q.options
      .map((o, i) => `<li><b>${esc(q.letters[i])}${q.answer.includes(o.id) ? " (correct)" : ""}.</b> ${esc(o.why)}</li>`)
      .join("")}</ul></div>`;
}

const quickKey = `<table><tr><th>Section</th><th>Answers</th></tr>${SECTIONS.map(
  (s) =>
    `<tr><td>${esc(s.title.split(": ")[1])}</td><td>${s.items
      .map((q) =>
        isTwoBlank(q)
          ? `${esc(q.num)}: ${q.blanks.map((b) => esc(b.options.find((o) => o.id === b.answer).text)).join(" / ")}`
          : `${esc(q.num)}: ${q.answer.map((id) => letterOf(q, id)).join(", ")}`,
      )
      .join(" &nbsp;·&nbsp; ")}</td></tr>`,
).join("")}</table>`;

const model = `<h2>FAST Writing: what a 4 does with these two sources</h2>
<p>It takes a side in the first paragraph. A strong claim is that a refusal should include a reason when the reason is true, because Source 2 shows that a warm, explained no preserves respect ("A gilded no is more satisfactory than a dry yes"), while Source 1's bare no is a one-time exercise for breaking the habit of over-explaining ("say no once without an excuse"). It addresses the counterclaim from Source 1 directly, using the word "once" and the distinction between an honest reason and an excuse meant to keep someone's approval. Each quotation is followed by a sentence explaining how it proves the point.</p>`;

const key = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<h1>Answer key and explanations</h1><p>Unit 1, Day 1: What Happens When You Stop Seeking Approval</p>
<h2>Quick key</h2>${quickKey}
${SECTIONS.map((s) => `<section class="page-break"><h2>${esc(s.title)}</h2>${s.items.map(keyItem).join("")}</section>`).join("")}
<section class="page-break">${model}</section></body></html>`;

function render(html, name) {
  const htmlPath = join(tmpdir(), `${name}.html`);
  writeFileSync(htmlPath, html);
  const pdfPath = join(outDir, `${name}.pdf`);
  rmSync(pdfPath, { force: true });
  try {
    execFileSync("google-chrome", [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${mkdtempSync(join(tmpdir(), "chrome-pdf-"))}`,
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ], { stdio: "ignore", timeout: 60000, killSignal: "SIGKILL" });
  } catch (err) {
    // Chrome sometimes keeps running after the PDF is written.
    if (!existsSync(pdfPath)) throw err;
  }
  console.log(pdfPath);
}

render(booklet, "unit1-day1-test-booklet");
render(key, "unit1-day1-answer-key");
