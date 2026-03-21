import { useState, useRef, useEffect, useMemo } from "react";

const CLASS_THEMES = {
  math: { name: "Advanced Mathematics", color: "#5B8C6A", emoji: "📐" },
  physics: { name: "Physics Lab", color: "#7B6CB0", emoji: "⚛️" },
  english: { name: "English Literature", color: "#C4785B", emoji: "📖" },
  history: { name: "World History", color: "#5886A5", emoji: "🌍" },
  cs: { name: "Computer Science", color: "#8B7355", emoji: "💻" },
  art: { name: "Art & Design", color: "#B07090", emoji: "🎨" },
};

const TASKS_DATA = [
  { id: 1, title: "Calculus Problem Set #4", classId: "math", startDate: "2026-03-10T09:00", dueDate: "2026-03-22T23:59", status: "in-progress",
    description: "Complete exercises 4.1 through 4.8 on integration by parts.",
    body: `## Instructions\n\nComplete **all exercises** from sections 4.1 through 4.8 in your textbook. This problem set focuses on **integration by parts** and related techniques.\n\n### Requirements\n\n- Show all work for full credit\n- Box your final answers\n- Use proper mathematical notation\n- Submit as a single PDF document\n\n### Topics Covered\n\n1. Integration by parts — standard form\n2. Tabular integration method\n3. Reduction formulas\n4. Applications to logarithmic and inverse trigonometric functions\n\n### Grading Rubric\n\n| Category | Points |\n|----------|--------|\n| Correctness | 60 |\n| Work shown | 25 |\n| Notation & neatness | 15 |\n| **Total** | **100** |\n\n### Tips\n\n> Remember the LIATE rule for choosing *u* and *dv*: **L**ogarithmic, **I**nverse trig, **A**lgebraic, **T**rigonometric, **E**xponential.\n\nIf you get stuck on any problem, refer to the worked examples in Chapter 4 or visit office hours (Tue/Thu 3–5 PM).\n\n---\n\n*Late submissions will receive a 10% deduction per day.*`,
    attachments: [
      { id: "a1", name: "Problem_Set_4.pdf", size: "2.4 MB" },
      { id: "a2", name: "Formula_Sheet.pdf", size: "340 KB" },
      { id: "a3", name: "Grading_Rubric.docx", size: "28 KB" }
    ]},
  { id: 2, title: "Lab Report: Wave Motion", classId: "physics", startDate: "2026-03-12T14:30", dueDate: "2026-03-25T17:00", status: "in-progress",
    description: "Write up findings from the wave interference experiment.",
    body: `## Lab Report: Wave Motion & Interference\n\nWrite a formal lab report documenting your findings from the wave interference experiment conducted in Lab 7.\n\n### Structure\n\n1. **Abstract** — Brief summary (150 words max)\n2. **Introduction** — Background theory on wave superposition\n3. **Methods** — Describe the experimental setup\n4. **Results** — Present data with graphs and tables\n5. **Discussion** — Analyze results, compare with theoretical predictions\n6. **Conclusion** — Summarize key findings\n\n### Data Analysis\n\nYou must include:\n- At least **3 graphs** created using Python or Excel\n- A comparison table of measured vs. predicted interference patterns\n- Error analysis with uncertainty propagation\n\n### Formatting\n\n- 12pt font, double-spaced\n- Include figure captions and table titles\n- Cite at least 3 sources using APA format\n\n> **Note:** Raw data from the experiment is available in the attached spreadsheet. You may work with your lab partner but must write the report individually.`,
    attachments: [
      { id: "a4", name: "Lab7_Raw_Data.xlsx", size: "1.1 MB" },
      { id: "a5", name: "Report_Template.docx", size: "45 KB" },
      { id: "a6", name: "Wave_Theory_Reference.pdf", size: "3.8 MB" },
      { id: "a7", name: "Sample_Report.pdf", size: "890 KB" }
    ]},
  { id: 3, title: "Essay: Modernist Poetry", classId: "english", startDate: "2026-03-08T10:00", dueDate: "2026-03-20T08:30", status: "overdue",
    description: "2000-word analysis of T.S. Eliot's The Waste Land.",
    body: `## Essay Assignment: Modernist Poetry Analysis\n\nWrite a **2000-word critical essay** analyzing T.S. Eliot's *The Waste Land* (1922).\n\n### Prompt\n\nExamine how Eliot uses **fragmentation**, **allusion**, and **multiple voices** to construct meaning in *The Waste Land*. How does the poem's structure reflect the modernist experience of disillusionment after World War I?\n\n### Requirements\n\n- Minimum 2000 words (excluding bibliography)\n- Must reference **at least 5 scholarly sources**\n- MLA format throughout\n- Include a Works Cited page\n- Original thesis statement required\n\n### Suggested Approach\n\n1. Close-read at least **two sections** of the poem in detail\n2. Connect the poem's techniques to broader modernist aesthetics\n3. Engage with existing critical interpretations\n\n### Submission\n\n- Submit via the class portal as a **.docx** file\n- Filename format: \`LastName_WasteLand_Essay.docx\`\n\n---\n\n*Plagiarism will result in automatic failure. Use Turnitin before submitting.*`,
    attachments: [
      { id: "a8", name: "Essay_Guidelines.pdf", size: "120 KB" },
      { id: "a9", name: "MLA_Quick_Reference.pdf", size: "95 KB" }
    ]},
  { id: 4, title: "Chapter 12 Reading Notes", classId: "history", startDate: "2026-03-15T08:00", dueDate: "2026-03-28T16:00", status: "not-started",
    description: "Summarize key events of the Cold War era.",
    body: `## Reading Notes: Chapter 12 — The Cold War Era\n\nComplete detailed reading notes for Chapter 12 of your textbook.\n\n### Focus Areas\n\n- The origins of US-Soviet tensions (1945–1947)\n- The Truman Doctrine and Marshall Plan\n- The Berlin Blockade and NATO formation\n- The Korean War and its global implications\n- McCarthyism and domestic impact\n\n### Format\n\nUse the **Cornell Notes** method:\n- Left column: key questions and terms\n- Right column: detailed notes\n- Bottom section: summary paragraph\n\n### Minimum Requirements\n\n- At least **4 pages** of handwritten notes (or 2 pages typed)\n- Include **5 key vocabulary terms** with definitions\n- Write a **200-word reflection** connecting Cold War themes to modern geopolitics\n\n> These notes will be used for the upcoming in-class discussion and debate.`,
    attachments: [
      { id: "a10", name: "Chapter_12_Textbook.pdf", size: "15.2 MB" },
      { id: "a11", name: "Cornell_Notes_Template.pdf", size: "58 KB" },
      { id: "a12", name: "Discussion_Questions.docx", size: "32 KB" }
    ]},
  { id: 5, title: "Binary Search Implementation", classId: "cs", startDate: "2026-03-14T13:00", dueDate: "2026-03-24T23:59", status: "in-progress",
    description: "Implement binary search in Python with unit tests.",
    body: "## Programming Assignment: Binary Search\n\nImplement the binary search algorithm in Python with comprehensive unit tests.\n\n### Tasks\n\n1. **Iterative** binary search function\n2. **Recursive** binary search function\n3. A variant that finds the **first occurrence** of a duplicate element\n4. A variant that finds the **insertion point** for a missing element\n\n### Code Requirements\n\n```python\ndef binary_search_iterative(arr, target):\n    \"\"\"Return index of target, or -1 if not found.\"\"\"\n    pass\n\ndef binary_search_recursive(arr, target, low=0, high=None):\n    \"\"\"Recursive implementation.\"\"\"\n    pass\n```\n\n- Use **type hints** for all function signatures\n- Include **docstrings** for every function\n- Handle edge cases: empty array, single element, target not found\n\n### Testing\n\n- Write at least **10 unit tests** using `pytest`\n- Cover edge cases and boundary conditions\n- Include a performance test comparing iterative vs recursive\n\n### Submission\n\n- Submit `binary_search.py` and `test_binary_search.py`\n- Code must pass `flake8` linting with zero errors",
    attachments: [
      { id: "a13", name: "starter_code.py", size: "1.2 KB" },
      { id: "a14", name: "test_template.py", size: "800 B" }
    ]},
  { id: 6, title: "Color Theory Composition", classId: "art", startDate: "2026-03-11T09:30", dueDate: "2026-03-23T15:00", status: "submitted",
    description: "Create a composition demonstrating complementary color relationships.",
    body: `## Studio Project: Color Theory Composition\n\nCreate an original composition that demonstrates your understanding of **complementary color relationships**.\n\n### Brief\n\nProduce a work (minimum 11×14 inches) using your choice of medium:\n- Acrylic paint\n- Gouache\n- Digital (Procreate, Photoshop, etc.)\n\n### Must Include\n\n- At least **one pair** of complementary colors as the dominant palette\n- Demonstration of **color temperature** shifts\n- Evidence of **value range** (light to dark)\n- A focal point created through **color contrast**\n\n### Process Documentation\n\nInclude a one-page artist statement covering:\n1. Your color palette choices and reasoning\n2. How you created visual hierarchy through color\n3. Reference artists or works that inspired your composition\n\n> Submit high-resolution photos of physical work or export digital work at 300 DPI.`,
    attachments: [
      { id: "a15", name: "Color_Wheel_Reference.pdf", size: "2.1 MB" },
      { id: "a16", name: "Artist_Statement_Template.docx", size: "22 KB" },
      { id: "a17", name: "Example_Compositions.zip", size: "18.4 MB" }
    ]},
  { id: 7, title: "Matrix Algebra Quiz Prep", classId: "math", startDate: "2026-03-18T10:00", dueDate: "2026-03-30T09:00", status: "not-started",
    description: "Review chapters 6-8 for the upcoming quiz.",
    body: `## Quiz Preparation: Matrix Algebra\n\nReview **Chapters 6–8** and complete the practice problems below.\n\n### Topics\n\n- Matrix multiplication and transposition\n- Determinants (2×2 and 3×3)\n- Inverse matrices\n- Systems of linear equations using Cramer's rule\n- Eigenvalues and eigenvectors (introductory)\n\n### Practice Problems\n\nComplete **all odd-numbered** problems from:\n- Section 6.3 (pp. 210–215)\n- Section 7.1 (pp. 238–242)\n- Section 8.2 (pp. 270–275)\n\n### Study Tips\n\n- Focus on the **mechanical steps** — the quiz will be computation-heavy\n- Memorize the formula for 3×3 determinants\n- Practice row reduction until it's automatic\n\n> The quiz will be 45 minutes, closed-book. You may use a basic calculator.`,
    attachments: [
      { id: "a18", name: "Practice_Problems.pdf", size: "1.5 MB" },
      { id: "a19", name: "Formula_Reference_Card.pdf", size: "180 KB" }
    ]},
  { id: 8, title: "Thermodynamics Problem Set", classId: "physics", startDate: "2026-03-16T11:00", dueDate: "2026-03-27T18:30", status: "not-started",
    description: "Solve problems on entropy and the second law.",
    body: `## Problem Set: Thermodynamics\n\nSolve all assigned problems on **entropy** and the **second law of thermodynamics**.\n\n### Problems\n\n1. Calculate the entropy change for an ideal gas expanding isothermally\n2. Carnot engine efficiency problems (3 variants)\n3. Clausius inequality applications\n4. Free energy and spontaneity determination\n5. Combined first and second law problems\n\n### Show Your Work\n\n- Start each problem with the relevant equation(s)\n- Clearly state assumptions\n- Include units throughout your calculations\n- Circle or box final answers\n\n> Refer to the attached formula sheet. Problems are from Chapter 9.`,
    attachments: [
      { id: "a20", name: "Thermo_Problems.pdf", size: "890 KB" },
      { id: "a21", name: "Formula_Sheet_Ch9.pdf", size: "210 KB" }
    ]},
  { id: 9, title: "Shakespeare Presentation", classId: "english", startDate: "2026-03-05T08:00", dueDate: "2026-03-18T14:00", status: "submitted",
    description: "Group presentation on Hamlet Act 3.",
    body: `## Group Presentation: Hamlet Act 3\n\nPrepare a **15-minute group presentation** analyzing Act 3 of *Hamlet*.\n\n### Requirements\n\n- Cover the major scenes and their significance\n- Analyze the **"To be or not to be"** soliloquy\n- Discuss the play-within-a-play (The Mousetrap)\n- Each group member must present for at least 3 minutes\n\n### Deliverables\n\n- Slide deck (Google Slides or PowerPoint)\n- A one-page handout for the class\n- Annotated passage selections\n\n> Presentations will be given in class. Order will be randomized.`,
    attachments: [
      { id: "a22", name: "Hamlet_Act3_Text.pdf", size: "420 KB" },
      { id: "a23", name: "Presentation_Rubric.pdf", size: "65 KB" }
    ]},
  { id: 10, title: "Renaissance Timeline", classId: "history", startDate: "2026-03-13T09:00", dueDate: "2026-03-26T20:00", status: "in-progress",
    description: "Create an illustrated timeline of key Renaissance events.",
    body: `## Project: Illustrated Renaissance Timeline\n\nCreate a visually engaging, illustrated timeline spanning **1300–1600 CE**.\n\n### Must Include\n\n- At least **20 dated events**\n- Events from art, science, politics, and religion\n- **5 illustrated entries** with images and captions\n- Brief descriptions (2–3 sentences) for each event\n\n### Format Options\n\n- Physical poster (minimum 24×36 inches)\n- Digital (Canva, Figma, or similar)\n- Interactive web page (bonus credit)\n\n### Key Figures to Feature\n\n- Leonardo da Vinci\n- Michelangelo\n- Gutenberg\n- Martin Luther\n- Galileo Galilei\n\n> Use the attached resource packet for primary sources and image references.`,
    attachments: [
      { id: "a24", name: "Renaissance_Resources.zip", size: "24.5 MB" },
      { id: "a25", name: "Timeline_Template.pptx", size: "5.2 MB" },
      { id: "a26", name: "Image_Sources.pdf", size: "1.8 MB" }
    ]},
  { id: 11, title: "REST API Project", classId: "cs", startDate: "2026-03-17T15:30", dueDate: "2026-04-02T23:59", status: "not-started",
    description: "Build a RESTful API with Flask and document endpoints.",
    body: "## Project: RESTful API with Flask\n\nBuild a fully functional REST API using **Flask** with proper documentation.\n\n### Endpoints Required\n\n```\nGET    /api/items          — List all items\nGET    /api/items/<id>     — Get single item\nPOST   /api/items          — Create new item\nPUT    /api/items/<id>     — Update item\nDELETE /api/items/<id>     — Delete item\n```\n\n### Technical Requirements\n\n- Use **SQLite** for data persistence\n- Implement input **validation** on all endpoints\n- Return proper **HTTP status codes**\n- Include **pagination** for list endpoints\n- Add **error handling** middleware\n\n### Documentation\n\n- Write API docs using **Swagger/OpenAPI** spec\n- Include example requests and responses\n- Document all error codes\n\n### Bonus\n\n- Add authentication with JWT tokens (+10%)\n- Deploy to Heroku or Railway (+5%)\n- Write integration tests with pytest (+5%)\n\n### Submission\n\n- Push to GitHub and submit the repo link\n- Include a `README.md` with setup instructions",
    attachments: [
      { id: "a27", name: "flask_starter.zip", size: "45 KB" },
      { id: "a28", name: "API_Design_Guide.pdf", size: "2.3 MB" },
      { id: "a29", name: "SQLite_Cheatsheet.pdf", size: "150 KB" }
    ]},
  { id: 12, title: "Watercolor Landscape", classId: "art", startDate: "2026-03-09T10:00", dueDate: "2026-03-21T12:00", status: "overdue",
    description: "Paint a landscape using wet-on-wet watercolor technique.",
    body: `## Studio Project: Watercolor Landscape\n\nCreate a landscape painting using the **wet-on-wet** watercolor technique.\n\n### Requirements\n\n- Minimum size: **9×12 inches** on watercolor paper (140 lb / 300 gsm)\n- Must use wet-on-wet technique for at least **60%** of the composition\n- Include atmospheric perspective (foreground, middle ground, background)\n\n### Technique Focus\n\n- **Washes**: Practice graded and variegated washes\n- **Blooms**: Use controlled blooms for organic textures\n- **Lifting**: Demonstrate the lifting technique for highlights\n- **Layering**: Build depth through transparent layers\n\n### Process\n\n1. Submit a **thumbnail sketch** (pencil) before painting\n2. Take **progress photos** at 3 stages\n3. Write a brief **reflection** (100 words) on challenges and discoveries\n\n> Bring your painting to class for group critique on the due date.`,
    attachments: [
      { id: "a30", name: "Technique_Demo_Video.mp4", size: "128 MB" },
      { id: "a31", name: "Reference_Landscapes.zip", size: "35 MB" },
      { id: "a32", name: "Paper_Supply_List.pdf", size: "40 KB" }
    ]},
];

const TODAY = new Date("2026-03-20T14:35");

function formatDate(str) {
  const d = new Date(str);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

function formatDateShort(str) {
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Compact format for Gantt bar labels: "Mar 10, 9:00AM"
function formatDateBar(str) {
  const d = new Date(str);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} ${time}`;
}

// Returns fractional days (precise to minutes) between two date strings or Date objects
function daysBetween(a, b) {
  const msA = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const msB = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return (msB - msA) / (1000 * 60 * 60 * 24);
}

const Icons = {
  Home: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  Settings: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>),
  LogOut: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  Plus: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Link: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>),
  Sun: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>),
  Moon: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>),
  ChevronRight: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>),
  List: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  Gantt: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="4" rx="1"/><rect x="7" y="10" width="12" height="4" rx="1"/><rect x="5" y="17" width="10" height="4" rx="1"/></svg>),
  Filter: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>),
  Notebook: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>),
  Check: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  Menu: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>),
  X: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Paperclip: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>),
  Sparkles: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>),
  ChevronDown: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>),
  ChevronUp: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>),
  Calendar: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  FileText: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  ArrowRight: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>),
  Loader: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>),
  Download: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  DownloadAll: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><line x1="8" y1="6" x2="8" y2="1"/><line x1="16" y1="6" x2="16" y2="1"/></svg>),
  Bold: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>),
  Italic: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>),
  Heading: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/></svg>),
  Code2: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>),
  ListOl: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>),
  Quote: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>),
  Image: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>),
  Link2: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>),
  Minus: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Upload: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>),
  Send: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>),
  ArrowLeft: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>),
  Eye: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>),
  Edit3: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>),
};

function CreateClassModal({ onClose, isDark }) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#5B8C6A");
  const colors = ["#5B8C6A","#7B6CB0","#C4785B","#5886A5","#8B7355","#B07090","#6B8FA3","#A0855B","#7A9B6D","#9B6B7A"];
  return (
    <div style={{position:"fixed",inset:0,zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.35)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:420,maxWidth:"90vw",borderRadius:14,padding:"32px 28px",background:isDark?"#1e1e1e":"#fffdf8",border:`1px solid ${isDark?"#333":"#e8e2d8"}`,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <h3 style={{margin:"0 0 24px",fontSize:18,fontWeight:600,color:isDark?"#e8e2d8":"#2c2825",fontFamily:"'Source Serif 4',Georgia,serif"}}>Create New Class</h3>
        <label style={{fontSize:12,fontWeight:500,color:isDark?"#999":"#8a8078",display:"block",marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>Class Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Advanced Mathematics" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${isDark?"#444":"#ddd5c8"}`,background:isDark?"#2a2a2a":"#fff",fontSize:14,color:isDark?"#e8e2d8":"#2c2825",outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif",marginBottom:20}}/>
        <label style={{fontSize:12,fontWeight:500,color:isDark?"#999":"#8a8078",display:"block",marginBottom:10,fontFamily:"'DM Sans',sans-serif"}}>Theme Color</label>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:28}}>
          {colors.map(c=>(<div key={c} onClick={()=>setSelectedColor(c)} style={{width:32,height:32,borderRadius:8,background:c,cursor:"pointer",border:selectedColor===c?`2.5px solid ${isDark?"#fff":"#2c2825"}`:"2.5px solid transparent",transform:selectedColor===c?"scale(1.1)":"scale(1)",transition:"all 0.15s ease"}}/>))}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:`1px solid ${isDark?"#444":"#ddd5c8"}`,background:"transparent",color:isDark?"#bbb":"#8a8078",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
          <button style={{padding:"9px 24px",borderRadius:8,border:"none",background:selectedColor,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Create Class</button>
        </div>
      </div>
    </div>
  );
}

function JoinClassModal({ onClose, isDark, themeColor }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.35)",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:400,maxWidth:"90vw",borderRadius:14,padding:"32px 28px",background:isDark?"#1e1e1e":"#fffdf8",border:`1px solid ${isDark?"#333":"#e8e2d8"}`,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:600,color:isDark?"#e8e2d8":"#2c2825",fontFamily:"'Source Serif 4',Georgia,serif"}}>Join a Class</h3>
        <p style={{margin:"0 0 24px",fontSize:13,color:isDark?"#888":"#a09890",fontFamily:"'DM Sans',sans-serif"}}>Enter the class code provided by your teacher.</p>
        <input placeholder="Enter class code" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${isDark?"#444":"#ddd5c8"}`,background:isDark?"#2a2a2a":"#fff",fontSize:14,color:isDark?"#e8e2d8":"#2c2825",outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif",marginBottom:24,letterSpacing:1}}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:`1px solid ${isDark?"#444":"#ddd5c8"}`,background:"transparent",color:isDark?"#bbb":"#8a8078",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
          <button style={{padding:"9px 24px",borderRadius:8,border:"none",background:themeColor,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Join Class</button>
        </div>
      </div>
    </div>
  );
}

function ListView({ tasks, activeClass, isDark, themeColor, onTaskClick }) {
  const textPrimary = isDark ? "#e8e2d8" : "#2c2825";
  const textSecondary = isDark ? "#888078" : "#8a8078";
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const statusLabel = (s) => {
    if (s === "submitted") return { text: "Submitted", color: "#5B8C6A", bg: "#5B8C6A18" };
    if (s === "overdue") return { text: "Overdue", color: "#c45c5c", bg: "#c45c5c18" };
    if (s === "in-progress") return { text: "In Progress", color: themeColor, bg: `${themeColor}18` };
    return { text: "Not Started", color: isDark ? "#666" : "#aaa59c", bg: isDark ? "#2a2622" : "#f0ece4" };
  };
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,2.2fr) minmax(0,1fr) minmax(0,1fr) 110px",gap:12,padding:"10px 16px",borderBottom:`1px solid ${borderColor}`,fontSize:10,fontWeight:700,color:isDark?"#666":"#bbb5aa",textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'DM Sans',sans-serif"}}>
        <span>Task</span><span>Start Date</span><span>Due Date</span><span>Status</span>
      </div>
      {tasks.map(task => {
        const classInfo = CLASS_THEMES[task.classId];
        const st = statusLabel(task.status);
        const isSubmitted = task.status === "submitted";
        return (
          <div key={task.id} onClick={() => onTaskClick && onTaskClick(task)} style={{display:"grid",gridTemplateColumns:"minmax(0,2.2fr) minmax(0,1fr) minmax(0,1fr) 110px",gap:12,padding:"13px 16px",borderBottom:`1px solid ${borderColor}`,cursor:"pointer",transition:"background 0.12s ease",alignItems:"center"}}
            onMouseEnter={e=>e.currentTarget.style.background=isDark?"#2a2826":"#f9f6f0"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:classInfo.color,flexShrink:0,opacity:isSubmitted?0.4:1}}/>
              <span style={{fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:500,color:isSubmitted?(isDark?"#666":"#c0b8ad"):textPrimary,textDecoration:isSubmitted?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</span>
            </div>
            <span style={{fontSize:12,color:textSecondary,fontFamily:"'DM Sans',sans-serif"}}>{formatDate(task.startDate)}</span>
            <span style={{fontSize:12,color:task.status==="overdue"?"#c45c5c":textSecondary,fontFamily:"'DM Sans',sans-serif",fontWeight:task.status==="overdue"?600:400}}>{formatDate(task.dueDate)}</span>
            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",padding:"4px 10px",borderRadius:6,color:st.color,background:st.bg,width:"fit-content"}}>{st.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function GanttChart({ tasks, activeClass, isDark, themeColor, ganttRange, onTaskClick }) {
  const sortedTasks = [...tasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const cardBg = isDark ? "#1e1c1a" : "#fffdf8";

  let minDate, maxDate;
  if (ganttRange === "week") {
    minDate = new Date(TODAY); minDate.setDate(minDate.getDate() - 1);
    maxDate = new Date(TODAY); maxDate.setDate(maxDate.getDate() + 7);
  } else if (ganttRange === "2month") {
    const allDates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.dueDate)]);
    minDate = new Date(Math.min(...allDates, TODAY.getTime()));
    maxDate = new Date(Math.max(...allDates, TODAY.getTime()));
    minDate.setDate(minDate.getDate() - 5);
    maxDate.setDate(maxDate.getDate() + 10);
    const span = daysBetween(minDate, maxDate);
    if (span < 60) maxDate.setDate(maxDate.getDate() + Math.ceil(60 - span));
  } else {
    const allDates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.dueDate)]);
    minDate = new Date(Math.min(...allDates, TODAY.getTime()));
    maxDate = new Date(Math.max(...allDates, TODAY.getTime()));
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 3);
    const span = daysBetween(minDate, maxDate);
    if (span < 30) maxDate.setDate(maxDate.getDate() + Math.ceil(30 - span));
  }

  const totalDays = daysBetween(minDate, maxDate);
  const todayOffset = daysBetween(minDate, TODAY);

  const markers = [];
  const md = new Date(minDate);
  const interval = ganttRange === "week" ? 1 : ganttRange === "2month" ? 14 : 7;
  while (md <= maxDate) { markers.push(new Date(md)); md.setDate(md.getDate() + interval); }

  const TASK_COL_W = 210;
  const DAY_W = ganttRange === "week" ? 80 : ganttRange === "2month" ? 14 : 22;
  const TIMELINE_W = totalDays * DAY_W;

  const [hoveredTask, setHoveredTask] = useState(null);
  const ROW_H = 44;
  const HEADER_H = 34;

  return (
    <div style={{ position: "relative", display: "flex", overflow: "hidden" }}>
      {/* Pinned task name column */}
      <div style={{ width: TASK_COL_W, flexShrink: 0, zIndex: 4, background: cardBg, borderRight: `1px solid ${borderColor}` }}>
        <div style={{ height: HEADER_H, display: "flex", alignItems: "flex-end", paddingBottom: 8, paddingLeft: 4, borderBottom: `1px solid ${borderColor}`, fontSize: 11, fontWeight: 600, color: isDark ? "#888" : "#a09890", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans',sans-serif" }}>
          Task
        </div>
        {sortedTasks.map((task) => {
          const classInfo = CLASS_THEMES[task.classId];
          const isSubmitted = task.status === "submitted";
          const isHovered = hoveredTask === task.id;
          return (
            <div key={task.id}
              onClick={() => onTaskClick && onTaskClick(task)}
              onMouseEnter={() => setHoveredTask(task.id)}
              onMouseLeave={() => setHoveredTask(null)}
              style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 10, paddingLeft: 4, paddingRight: 8, background: isHovered ? (isDark ? "#2a2826" : "#f9f6f0") : "transparent", transition: "background 0.15s ease", cursor: "pointer" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: classInfo.color, flexShrink: 0, opacity: isSubmitted ? 0.4 : 1 }} />
              <span style={{ fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: isSubmitted ? (isDark ? "#666" : "#c0b8ad") : (isDark ? "#d5cfc5" : "#3d3833"), textDecoration: isSubmitted ? "line-through" : "none", fontWeight: isHovered ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
            </div>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div style={{ flex: 1, overflowX: "auto", position: "relative" }}>
        <div style={{ width: TIMELINE_W, minWidth: "100%", position: "relative" }}>
          {/* Date headers */}
          <div style={{ height: HEADER_H, display: "flex", alignItems: "flex-end", paddingBottom: 8, borderBottom: `1px solid ${borderColor}`, position: "relative" }}>
            {markers.map((w, i) => {
              const offset = daysBetween(minDate, w);
              return (
                <div key={i} style={{ position: "absolute", left: `${(offset / totalDays) * 100}%`, fontSize: 10, color: isDark ? "#666" : "#bbb5aa", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, whiteSpace: "nowrap" }}>
                  {w.toLocaleDateString("en-US", ganttRange === "week" ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" })}
                </div>
              );
            })}
          </div>

          {/* Today label pinned at top */}
          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div style={{ position: "absolute", top: 0, zIndex: 5, left: `${(todayOffset / totalDays) * 100}%`, transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", color: "#fff", background: "#d6394c", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Today</div>
          )}

          {/* Today vertical line spanning full height */}
          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div style={{ position: "absolute", left: `${(todayOffset / totalDays) * 100}%`, top: HEADER_H, bottom: 0, width: 2, background: "#d6394c", opacity: 0.55, zIndex: 3 }} />
          )}

          {/* Task bars */}
          {sortedTasks.map((task) => {
            const classInfo = CLASS_THEMES[task.classId];
            const taskColor = activeClass === "home" ? classInfo.color : themeColor;
            // Clamp visible portion of bar to the timeline window
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.dueDate);
            const visStart = taskStart < minDate ? minDate : taskStart;
            const visEnd = taskEnd > maxDate ? maxDate : taskEnd;
            // Skip tasks entirely outside the visible range
            if (visStart >= visEnd) {
              return (
                <div key={task.id}
                  onClick={() => onTaskClick && onTaskClick(task)}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                  style={{ height: ROW_H, position: "relative", display: "flex", alignItems: "center", background: hoveredTask === task.id ? (isDark ? "#2a2826" : "#f9f6f0") : "transparent", transition: "background 0.15s ease", cursor: "pointer" }}>
                  <span style={{ fontSize: 10, fontFamily: "'DM Sans',sans-serif", color: isDark ? "#555" : "#ccc5ba", paddingLeft: 8, fontStyle: "italic" }}>Outside range</span>
                </div>
              );
            }
            const clampedStart = daysBetween(minDate, visStart);
            const clampedDuration = daysBetween(visStart, visEnd);
            const leftPct = (clampedStart / totalDays) * 100;
            const widthPct = (clampedDuration / totalDays) * 100;
            const startsBeforeView = taskStart < minDate;
            const endsAfterView = taskEnd > maxDate;
            const isOverdue = task.status === "overdue";
            const isSubmitted = task.status === "submitted";
            const isHovered = hoveredTask === task.id;
            return (
              <div key={task.id}
                onClick={() => onTaskClick && onTaskClick(task)}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                style={{ height: ROW_H, position: "relative", display: "flex", alignItems: "center", background: isHovered ? (isDark ? "#2a2826" : "#f9f6f0") : "transparent", transition: "background 0.15s ease", cursor: "pointer" }}>
                <div style={{
                  position: "absolute",
                  left: `${leftPct}%`, width: `${Math.max(widthPct, 1.5)}%`,
                  height: 24,
                  borderRadius: `${startsBeforeView ? 0 : 6}px ${endsAfterView ? 0 : 6}px ${endsAfterView ? 0 : 6}px ${startsBeforeView ? 0 : 6}px`,
                  background: isSubmitted ? (isDark ? "#333" : "#e8e2d8") : isOverdue ? `${taskColor}30` : `${taskColor}${isDark ? "50" : "28"}`,
                  border: isOverdue ? `1.5px dashed ${taskColor}` : "none",
                  transition: "all 0.2s ease",
                  transform: isHovered ? "scaleY(1.15)" : "scaleY(1)",
                  display: "flex", alignItems: "center", paddingLeft: 8, overflow: "hidden", zIndex: 1
                }}>
                  <span style={{ fontSize: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, color: isSubmitted ? (isDark ? "#666" : "#bbb5aa") : taskColor, whiteSpace: "nowrap", opacity: isHovered ? 1 : 0.8 }}>
                    {formatDateBar(task.startDate)} — {formatDateBar(task.dueDate)}
                    {isOverdue && " · Overdue"}
                    {isSubmitted && " · Submitted"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Simple Markdown Renderer ---
function MarkdownRenderer({ content, isDark, themeColor }) {
  const textPrimary = isDark ? "#e8e2d8" : "#2c2825";
  const textSecondary = isDark ? "#888078" : "#8a8078";
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const codeBg = isDark ? "#252320" : "#f0ece4";

  const renderInline = (text) => {
    const parts = [];
    let remaining = text;
    let key = 0;
    const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+?)`|\[([^\]]+?)\]\(([^)]+?)\))/;
    while (remaining) {
      const m = remaining.match(inlineRe);
      if (!m) { parts.push(<span key={key++}>{remaining}</span>); break; }
      if (m.index > 0) parts.push(<span key={key++}>{remaining.slice(0, m.index)}</span>);
      if (m[2]) parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={key++} style={{ fontStyle: "italic" }}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={key++} style={{ background: codeBg, padding: "1px 6px", borderRadius: 4, fontSize: "0.88em", fontFamily: "'SF Mono','Fira Code',monospace" }}>{m[4]}</code>);
      else if (m[5]) parts.push(<a key={key++} href={m[6]} style={{ color: themeColor, textDecoration: "underline" }}>{m[5]}</a>);
      remaining = remaining.slice(m.index + m[0].length);
    }
    return parts;
  };

  const lines = content.split("\n");
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      elements.push(
        <pre key={key++} style={{
          background: isDark ? "#141210" : "#f0ece4", borderRadius: 10, padding: "16px 18px",
          margin: "12px 0", overflowX: "auto", fontSize: 12.5, lineHeight: 1.7,
          fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
          color: isDark ? "#c8c0b5" : "#4a4540",
          border: `1px solid ${borderColor}`
        }}><code>{codeLines.join("\n")}</code></pre>
      );
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|[\s\-:|]+\|$/)) {
      const headerCells = line.split("|").filter(c => c.trim());
      i += 2; // skip separator
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").filter(c => c.trim()));
        i++;
      }
      elements.push(
        <div key={key++} style={{ overflowX: "auto", margin: "12px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {headerCells.map((c, ci) => (
                  <th key={ci} style={{
                    textAlign: "left", padding: "8px 14px", fontWeight: 600,
                    borderBottom: `2px solid ${borderColor}`, color: textPrimary,
                    fontSize: 12, fontFamily: "'DM Sans',sans-serif"
                  }}>{c.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} style={{
                      padding: "7px 14px", borderBottom: `1px solid ${borderColor}`,
                      color: textSecondary, fontSize: 13, fontFamily: "'DM Sans',sans-serif"
                    }}>{renderInline(c.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith("### ")) { elements.push(<h4 key={key++} style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: "20px 0 8px", fontFamily: "'Source Serif 4',Georgia,serif" }}>{renderInline(line.slice(4))}</h4>); i++; continue; }
    if (line.startsWith("## ")) { elements.push(<h3 key={key++} style={{ fontSize: 18, fontWeight: 700, color: textPrimary, margin: "24px 0 10px", fontFamily: "'Source Serif 4',Georgia,serif" }}>{renderInline(line.slice(3))}</h3>); i++; continue; }
    if (line.startsWith("# ")) { elements.push(<h2 key={key++} style={{ fontSize: 22, fontWeight: 700, color: textPrimary, margin: "28px 0 12px", fontFamily: "'Source Serif 4',Georgia,serif" }}>{renderInline(line.slice(2))}</h2>); i++; continue; }

    // Horizontal rule
    if (line.match(/^---+$/)) { elements.push(<hr key={key++} style={{ border: "none", borderTop: `1px solid ${borderColor}`, margin: "20px 0" }} />); i++; continue; }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) { quoteLines.push(lines[i].slice(2)); i++; }
      elements.push(
        <blockquote key={key++} style={{
          borderLeft: `3px solid ${themeColor}`, paddingLeft: 16, margin: "14px 0",
          color: textSecondary, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.7
        }}>{quoteLines.map((ql, qi) => <span key={qi}>{renderInline(ql)}{qi < quoteLines.length - 1 && <br />}</span>)}</blockquote>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      elements.push(
        <ol key={key++} style={{ paddingLeft: 24, margin: "10px 0", lineHeight: 1.8, fontSize: 14, color: textPrimary }}>
          {items.map((item, ii) => <li key={ii} style={{ marginBottom: 4 }}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Unordered list
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
      elements.push(
        <ul key={key++} style={{ paddingLeft: 24, margin: "10px 0", lineHeight: 1.8, fontSize: 14, color: textPrimary, listStyleType: "disc" }}>
          {items.map((item, ii) => <li key={ii} style={{ marginBottom: 4 }}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) { i++; continue; }

    // Paragraph
    elements.push(<p key={key++} style={{ margin: "8px 0", lineHeight: 1.8, fontSize: 14, color: textPrimary }}>{renderInline(line)}</p>);
    i++;
  }

  return <div>{elements}</div>;
}

// File extension to icon color mapping
function getFileColor(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "#c45c5c";
  if (["doc", "docx"].includes(ext)) return "#5886A5";
  if (["xls", "xlsx", "csv"].includes(ext)) return "#5B8C6A";
  if (["ppt", "pptx"].includes(ext)) return "#C4785B";
  if (["zip", "rar", "7z"].includes(ext)) return "#8B7355";
  if (["py", "js", "ts", "html", "css"].includes(ext)) return "#7B6CB0";
  if (["mp4", "mov", "avi"].includes(ext)) return "#B07090";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "#6B8FA3";
  return "#8a8078";
}

function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["mp4", "mov", "avi"].includes(ext)) return "🎬";
  if (["zip", "rar", "7z"].includes(ext)) return "📦";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "🖼";
  return "📄";
}

// --- Task Detail Overlay ---
function TaskDetailOverlay({ task, onClose, isDark, themeColor, onSubmit }) {
  const classInfo = CLASS_THEMES[task.classId];
  const bg = isDark ? "#1e1c1a" : "#fffdf8";
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const textPrimary = isDark ? "#e8e2d8" : "#2c2825";
  const textSecondary = isDark ? "#888078" : "#8a8078";
  const textMuted = isDark ? "#5a5550" : "#c0b8ad";
  const sidebarBg = isDark ? "#181614" : "#f7f4ee";

  const statusInfo = (s) => {
    if (s === "submitted") return { text: "Submitted", color: "#5B8C6A", bg: "#5B8C6A18" };
    if (s === "overdue") return { text: "Overdue", color: "#c45c5c", bg: "#c45c5c18" };
    if (s === "in-progress") return { text: "In Progress", color: classInfo.color, bg: `${classInfo.color}18` };
    return { text: "Not Started", color: isDark ? "#888" : "#aaa59c", bg: isDark ? "#2a2622" : "#f0ece4" };
  };
  const st = statusInfo(task.status);

  const [isMobileDetail, setIsMobileDetail] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileDetail(window.innerWidth < 700);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1300,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(5px)",
      animation: "fadeOverlay 0.2s ease", padding: 16
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 960, maxWidth: "100%", height: "85vh", maxHeight: 720,
        borderRadius: 18, background: bg,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column",
        animation: "fadeIn 0.2s ease", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "22px 28px 18px", borderBottom: `1px solid ${borderColor}`,
          display: "flex", flexDirection: "column", gap: 12, flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: classInfo.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: classInfo.color, fontFamily: "'DM Sans',sans-serif" }}>{classInfo.name}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                  color: st.color, background: st.bg, fontFamily: "'DM Sans',sans-serif"
                }}>{st.text}</span>
              </div>
              <h2 style={{
                fontSize: 24, fontWeight: 700, color: textPrimary,
                fontFamily: "'Source Serif 4',Georgia,serif", letterSpacing: "-0.02em", lineHeight: 1.3
              }}>{task.title}</h2>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: "none", flexShrink: 0,
              background: isDark ? "#2a2622" : "#f0ece4", color: textSecondary,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
            }}><Icons.X /></button>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 12.5, color: textSecondary, fontFamily: "'DM Sans',sans-serif", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Icons.Calendar /> Start: <strong style={{ color: textPrimary, fontWeight: 600 }}>{formatDate(task.startDate)}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Icons.Calendar /> Due: <strong style={{ color: task.status === "overdue" ? "#c45c5c" : textPrimary, fontWeight: 600 }}>{formatDate(task.dueDate)}</strong>
            </span>
          </div>
        </div>

        {/* Body + Sidebar */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: isMobileDetail ? "column" : "row" }}>
          {/* Main markdown body */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "24px 28px 28px",
            minWidth: 0
          }}>
            {task.body ? (
              <MarkdownRenderer content={task.body} isDark={isDark} themeColor={classInfo.color} />
            ) : (
              <p style={{ color: textMuted, fontStyle: "italic", fontSize: 14 }}>{task.description}</p>
            )}
          </div>

          {/* Attachment sidebar */}
          {task.attachments && task.attachments.length > 0 && (
            <div style={{
              width: isMobileDetail ? "100%" : 260, flexShrink: 0,
              borderLeft: isMobileDetail ? "none" : `1px solid ${borderColor}`,
              borderTop: isMobileDetail ? `1px solid ${borderColor}` : "none",
              background: sidebarBg, display: "flex", flexDirection: "column",
              overflowY: "auto"
            }}>
              <div style={{
                padding: "18px 18px 10px", fontSize: 11, fontWeight: 700, color: textMuted,
                textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans',sans-serif"
              }}>
                Attachments ({task.attachments.length})
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
                {task.attachments.map(att => {
                  const fColor = getFileColor(att.name);
                  return (
                    <div key={att.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 10px", borderRadius: 9, marginBottom: 4,
                      transition: "background 0.12s ease", cursor: "pointer"
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? "#252320" : "#ede8df"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${fColor}15`, color: fColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, flexShrink: 0
                      }}>{getFileIcon(att.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: 500, color: textPrimary,
                          fontFamily: "'DM Sans',sans-serif",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>{att.name}</div>
                        <div style={{ fontSize: 10.5, color: textMuted, fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>
                          {att.size}
                        </div>
                      </div>
                      <button title="Download" style={{
                        width: 28, height: 28, borderRadius: 6, border: "none", flexShrink: 0,
                        background: isDark ? "#2a2622" : "#e8e2d8", color: textSecondary,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", transition: "all 0.12s ease", padding: 0
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = classInfo.color; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isDark ? "#2a2622" : "#e8e2d8"; e.currentTarget.style.color = textSecondary; }}
                      ><Icons.Download /></button>
                    </div>
                  );
                })}
              </div>
              {/* Download All */}
              <div style={{ padding: "10px 14px 16px" }}>
                <button style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "9px 0", borderRadius: 8,
                  border: `1.5px solid ${isDark ? "#3a3630" : borderColor}`,
                  background: "transparent", color: textSecondary,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", transition: "all 0.12s ease"
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${classInfo.color}12`; e.currentTarget.style.color = classInfo.color; e.currentTarget.style.borderColor = classInfo.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textSecondary; e.currentTarget.style.borderColor = isDark ? "#3a3630" : borderColor; }}
                >
                  <Icons.Download /> Download All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Submit button */}
        <div style={{
          padding: "16px 28px 20px", borderTop: `1px solid ${borderColor}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
        }}>
          <span style={{ fontSize: 12, color: textMuted, fontFamily: "'DM Sans',sans-serif" }}>
            {task.status === "submitted"
              ? "You have already submitted this assignment."
              : task.status === "overdue"
                ? "This assignment is past due."
                : `Due ${formatDate(task.dueDate)}`}
          </span>
          <button
            onClick={() => { if (task.status !== "submitted" && onSubmit) { onSubmit(task); } }}
            style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 28px", borderRadius: 10, border: "none",
            background: task.status === "submitted" ? (isDark ? "#2a2622" : "#e8e2d8") : classInfo.color,
            color: task.status === "submitted" ? textMuted : "#fff",
            fontSize: 14, fontWeight: 700, cursor: task.status === "submitted" ? "default" : "pointer",
            fontFamily: "'DM Sans',sans-serif",
            transition: "all 0.2s ease",
            boxShadow: task.status === "submitted" ? "none" : `0 3px 16px ${classInfo.color}40`
          }}>
            {task.status === "submitted" ? "Submitted" : "Submit Assignment"} <Icons.ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Post Task Overlay ---
function PostTaskOverlay({ visible, onClose, isDark, themeColor, className, onEditBody }) {
  const [rawText, setRawText] = useState("");
  const [showTraditional, setShowTraditional] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [touched, setTouched] = useState({});
  const textRef = useRef(null);
  const overlayRef = useRef(null);

  const hasText = rawText.trim().length > 0;

  // Validation
  const errors = {
    title: touched.title && !title.trim(),
    startDate: touched.startDate && !startDate,
    endDate: touched.endDate && !endDate,
    dateOrder: touched.endDate && startDate && endDate && new Date(endDate) <= new Date(startDate),
  };
  const allValid = title.trim() && startDate && endDate && new Date(endDate) > new Date(startDate);

  // Simulate AI parsing
  const handleAiParse = () => {
    setAiParsing(true);
    setShowTraditional(true);
    setTimeout(() => {
      // Simple mock: extract first line as title, guess dates
      const lines = rawText.trim().split("\n");
      const extractedTitle = lines[0]?.replace(/^(post|create|assign|task|hw|homework|assignment)[:\s]*/i, "").trim() || "";
      if (extractedTitle && !title) setTitle(extractedTitle);

      // Look for date patterns in text
      const datePatterns = rawText.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/g);
      const monthPatterns = rawText.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/gi);

      if (!startDate) {
        const now = new Date();
        setStartDate(now.toISOString().slice(0, 16));
      }
      if (!endDate) {
        const due = new Date();
        // Look for keywords suggesting duration
        const weekMatch = rawText.match(/(\d+)\s*week/i);
        const dayMatch = rawText.match(/(\d+)\s*day/i);
        if (weekMatch) {
          due.setDate(due.getDate() + parseInt(weekMatch[1]) * 7);
        } else if (dayMatch) {
          due.setDate(due.getDate() + parseInt(dayMatch[1]));
        } else {
          due.setDate(due.getDate() + 7);
        }
        due.setHours(23, 59, 0, 0);
        setEndDate(due.toISOString().slice(0, 16));
      }

      // Check for late submission mentions
      if (/late|extension|flexible|grace/i.test(rawText)) {
        setAllowLate(true);
      }

      setAiParsing(false);
      setAiDone(true);
      setTouched({ title: true, startDate: true, endDate: true });
    }, 1200);
  };

  const handleMockAttach = () => {
    const mockFiles = ["problem_set.pdf", "rubric.docx", "reference_material.pdf", "template.xlsx"];
    const next = mockFiles[attachments.length % mockFiles.length];
    setAttachments(prev => [...prev, { name: next, id: Date.now() }]);
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Colors
  const bg = isDark ? "#1e1c1a" : "#fffdf8";
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const textPrimary = isDark ? "#e8e2d8" : "#2c2825";
  const textSecondary = isDark ? "#888078" : "#8a8078";
  const textMuted = isDark ? "#5a5550" : "#c0b8ad";
  const inputBg = isDark ? "#252320" : "#faf7f2";
  const errorColor = "#c45c5c";

  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
        animation: "fadeOverlay 0.2s ease",
        padding: 16
      }}
    >
      <div
        ref={overlayRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: 600, maxWidth: "100%", maxHeight: "90vh",
          borderRadius: 16, background: bg,
          border: `1px solid ${borderColor}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          animation: "fadeIn 0.2s ease",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 3, background: themeColor }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, fontFamily: "'Source Serif 4',Georgia,serif" }}>
              Post Task — {className}
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: "none",
            background: isDark ? "#2a2622" : "#f0ece4", color: textSecondary,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
          }}><Icons.X /></button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 20px" }}>
          {/* Text area */}
          <div style={{
            position: "relative", borderRadius: 12,
            border: `1.5px solid ${isDark ? "#333" : "#ddd5c8"}`,
            background: inputBg, transition: "border-color 0.2s ease",
            marginBottom: 12
          }}>
            <textarea
              ref={textRef}
              value={rawText}
              onChange={e => { setRawText(e.target.value); setAiDone(false); }}
              placeholder={"Describe your task here...\ne.g. \"Complete Chapter 5 exercises, due in 2 weeks, allow late submissions\""}
              style={{
                width: "100%", minHeight: 130, padding: "16px 16px 50px",
                border: "none", background: "transparent", resize: "vertical",
                fontSize: 14, lineHeight: 1.7, color: textPrimary,
                fontFamily: "'DM Sans',sans-serif", outline: "none",
                boxSizing: "border-box"
              }}
            />
            {/* Bottom bar inside textarea */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px",
              borderTop: `1px solid ${isDark ? "#2a2622" : "#ede8df"}`
            }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {/* Attachment button */}
                <button onClick={handleMockAttach} title="Add Attachment" style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  borderRadius: 6, border: `1px solid ${isDark ? "#3a3630" : "#ddd5c8"}`,
                  background: "transparent", color: textSecondary, fontSize: 11, fontWeight: 500,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.12s ease"
                }}>
                  <Icons.Paperclip /> Attach
                </button>
                {/* Expand traditional view */}
                <button onClick={() => setShowTraditional(v => !v)} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  borderRadius: 6, border: `1px solid ${isDark ? "#3a3630" : "#ddd5c8"}`,
                  background: showTraditional ? `${themeColor}12` : "transparent",
                  color: showTraditional ? themeColor : textSecondary,
                  fontSize: 11, fontWeight: 500, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", transition: "all 0.12s ease"
                }}>
                  {showTraditional ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                  {showTraditional ? "Collapse" : "Expand Form"}
                </button>
              </div>
              {/* AI Parsing */}
              {hasText && (
                <button
                  onClick={handleAiParse}
                  disabled={aiParsing}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 14px",
                    borderRadius: 7, border: "none",
                    background: aiDone ? `${themeColor}15` : `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                    color: aiDone ? themeColor : "#fff",
                    fontSize: 11, fontWeight: 600, cursor: aiParsing ? "wait" : "pointer",
                    fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s ease",
                    boxShadow: aiDone ? "none" : `0 2px 8px ${themeColor}40`,
                    opacity: aiParsing ? 0.7 : 1,
                    animation: aiParsing ? "none" : undefined
                  }}
                >
                  {aiParsing ? (
                    <><span style={{ display: "inline-flex", animation: "spin 1s linear infinite" }}><Icons.Loader /></span> Parsing...</>
                  ) : aiDone ? (
                    <><Icons.Check /> Parsed</>
                  ) : (
                    <><Icons.Sparkles /> AI Parse</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {attachments.map(a => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 7,
                  background: isDark ? "#252320" : "#f0ece4",
                  fontSize: 11, color: textSecondary, fontFamily: "'DM Sans',sans-serif"
                }}>
                  <Icons.FileText />
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  <button onClick={() => removeAttachment(a.id)} style={{
                    width: 16, height: 16, borderRadius: 4, border: "none",
                    background: isDark ? "#3a3630" : "#ddd5c8", color: textMuted,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0, marginLeft: 2
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Traditional Form (expandable) */}
          <div style={{
            maxHeight: showTraditional ? 500 : 0,
            opacity: showTraditional ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease"
          }}>
            <div style={{
              borderRadius: 12, border: `1px solid ${borderColor}`,
              background: isDark ? "#1a1816" : "#faf7f2",
              padding: "20px 20px 16px", marginBottom: 4
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>
                Task Details
              </div>

              {/* Title */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: textSecondary, display: "block", marginBottom: 5, fontFamily: "'DM Sans',sans-serif" }}>
                  Task Title <span style={{ color: errorColor }}>*</span>
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => setTouched(p => ({ ...p, title: true }))}
                  placeholder="e.g. Chapter 5 Problem Set"
                  style={{
                    width: "100%", padding: "9px 14px", borderRadius: 8,
                    border: `1.5px solid ${errors.title ? errorColor : (isDark ? "#3a3630" : "#ddd5c8")}`,
                    background: isDark ? "#252320" : "#fff", fontSize: 13, color: textPrimary,
                    outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif",
                    transition: "border-color 0.15s ease"
                  }}
                />
                {errors.title && <span style={{ fontSize: 11, color: errorColor, marginTop: 4, display: "block", fontFamily: "'DM Sans',sans-serif" }}>Title is required</span>}
              </div>

              {/* Dates row */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: textSecondary, display: "flex", alignItems: "center", gap: 5, marginBottom: 5, fontFamily: "'DM Sans',sans-serif" }}>
                    <Icons.Calendar /> Start Date <span style={{ color: errorColor }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    onBlur={() => setTouched(p => ({ ...p, startDate: true }))}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8,
                      border: `1.5px solid ${errors.startDate ? errorColor : (isDark ? "#3a3630" : "#ddd5c8")}`,
                      background: isDark ? "#252320" : "#fff", fontSize: 12.5, color: textPrimary,
                      outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif",
                      colorScheme: isDark ? "dark" : "light"
                    }}
                  />
                  {errors.startDate && <span style={{ fontSize: 11, color: errorColor, marginTop: 4, display: "block" }}>Start date is required</span>}
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: textSecondary, display: "flex", alignItems: "center", gap: 5, marginBottom: 5, fontFamily: "'DM Sans',sans-serif" }}>
                    <Icons.Calendar /> Due Date <span style={{ color: errorColor }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    onBlur={() => setTouched(p => ({ ...p, endDate: true }))}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8,
                      border: `1.5px solid ${(errors.endDate || errors.dateOrder) ? errorColor : (isDark ? "#3a3630" : "#ddd5c8")}`,
                      background: isDark ? "#252320" : "#fff", fontSize: 12.5, color: textPrimary,
                      outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif",
                      colorScheme: isDark ? "dark" : "light"
                    }}
                  />
                  {errors.endDate && <span style={{ fontSize: 11, color: errorColor, marginTop: 4, display: "block" }}>Due date is required</span>}
                  {errors.dateOrder && !errors.endDate && <span style={{ fontSize: 11, color: errorColor, marginTop: 4, display: "block" }}>Due date must be after start date</span>}
                </div>
              </div>

              {/* Allow Late */}
              <div
                onClick={() => setAllowLate(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  padding: "8px 0", userSelect: "none"
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  border: `1.5px solid ${allowLate ? themeColor : (isDark ? "#3a3630" : "#ccc5b8")}`,
                  background: allowLate ? themeColor : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease", flexShrink: 0
                }}>
                  {allowLate && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: 13, color: textPrimary, fontFamily: "'DM Sans',sans-serif", fontWeight: 400 }}>
                  Allow late submission
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px 20px",
          borderTop: `1px solid ${borderColor}`,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <span style={{ fontSize: 11, color: textMuted, fontFamily: "'DM Sans',sans-serif" }}>
            {!showTraditional && hasText && "Use AI Parse or expand form to fill details"}
            {showTraditional && !allValid && "Fill all required fields to continue"}
            {showTraditional && allValid && "Ready to edit task body"}
          </span>
          <button
            disabled={!allValid}
            onClick={() => { if (allValid && onEditBody) { onEditBody({ title, startDate, endDate, allowLate, rawText, attachments }); } }}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "10px 22px", borderRadius: 9, border: "none",
              background: allValid ? themeColor : (isDark ? "#2a2622" : "#e8e2d8"),
              color: allValid ? "#fff" : textMuted,
              fontSize: 13, fontWeight: 600, cursor: allValid ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.2s ease",
              boxShadow: allValid ? `0 2px 12px ${themeColor}40` : "none",
              opacity: allValid ? 1 : 0.7
            }}
          >
            Edit Body <Icons.ArrowRight />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

// --- Editor Page (flat, full main area) ---
function EditorPage({ editorState, onBack, isDark, themeColor, isMobile }) {
  const { mode, task, classId, postData } = editorState;
  const classInfo = CLASS_THEMES[classId] || {};
  const accentColor = classInfo.color || themeColor;

  const bg = isDark ? "#1a1816" : "#faf7f2";
  const cardBg = isDark ? "#1e1c1a" : "#fffdf8";
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const textPrimary = isDark ? "#e8e2d8" : "#2c2825";
  const textSecondary = isDark ? "#888078" : "#8a8078";
  const textMuted = isDark ? "#5a5550" : "#c0b8ad";
  const inputBg = isDark ? "#252320" : "#faf7f2";
  const sidebarBg = isDark ? "#181614" : "#f7f4ee";

  const isSubmit = mode === "submit";
  const pageTitle = isSubmit ? "Submit Assignment" : "Edit Task Body";
  const taskTitle = isSubmit ? task?.title : (postData?.title || "Untitled Task");

  const [content, setContent] = useState(isSubmit ? "" : (postData?.rawText || ""));
  const [attachments, setAttachments] = useState(isSubmit ? [] : (postData?.attachments || []).map(a => ({ ...a, id: a.id || Date.now() + Math.random() })));
  const [dragOver, setDragOver] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const textareaRef = useRef(null);

  // Toolbar actions
  const insertAtCursor = (before, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = before + (selected || "text") + after;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      const cursorPos = start + before.length + (selected || "text").length + after.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const toolbarItems = [
    { icon: <Icons.Bold />, label: "Bold", action: () => insertAtCursor("**", "**") },
    { icon: <Icons.Italic />, label: "Italic", action: () => insertAtCursor("*", "*") },
    { icon: <Icons.Heading />, label: "Heading", action: () => insertAtCursor("## ", "") },
    { sep: true },
    { icon: <Icons.Code2 />, label: "Code", action: () => insertAtCursor("`", "`") },
    { icon: <Icons.Quote />, label: "Quote", action: () => insertAtCursor("> ", "") },
    { icon: <Icons.ListOl />, label: "List", action: () => insertAtCursor("1. ", "") },
    { icon: <Icons.Minus />, label: "Divider", action: () => insertAtCursor("\n---\n", "") },
    { sep: true },
    { icon: <Icons.Image />, label: "Image", action: () => insertAtCursor("![alt](", ")") },
    { icon: <Icons.Link2 />, label: "Link", action: () => insertAtCursor("[", "](url)") },
  ];

  // Mock file drop / upload
  const addMockFile = (name) => {
    setAttachments(prev => [...prev, { id: Date.now() + Math.random(), name, size: `${(Math.random() * 5 + 0.1).toFixed(1)} MB` }]);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length) {
      Array.from(files).forEach(f => addMockFile(f.name));
    } else {
      addMockFile("dropped_file.pdf");
    }
  };

  const handleMockUpload = () => {
    const names = ["my_submission.pdf", "notes.docx", "screenshot.png", "data.xlsx", "code.py", "diagram.svg"];
    addMockFile(names[attachments.length % names.length]);
  };

  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  // Word count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Editor Header */}
      <div style={{
        padding: isMobile ? "14px 16px" : "16px 32px",
        borderBottom: `1px solid ${borderColor}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: cardBg, flexShrink: 0, gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button onClick={onBack} style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${borderColor}`,
            background: "transparent", color: textSecondary,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, padding: 0
          }}><Icons.ArrowLeft /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, fontFamily: "'DM Sans',sans-serif" }}>
              {isSubmit ? "Submitting to" : "Publishing in"} · {classInfo.name}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 700, color: textPrimary,
              fontFamily: "'Source Serif 4',Georgia,serif",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {taskTitle}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Preview toggle */}
          <button
            onClick={() => setPreviewMode(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8,
              border: `1.5px solid ${previewMode ? accentColor : borderColor}`,
              background: previewMode ? `${accentColor}12` : "transparent",
              color: previewMode ? accentColor : textSecondary,
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif"
            }}
          >
            {previewMode ? <Icons.Edit3 /> : <Icons.Eye />}
            {previewMode ? "Edit" : "Preview"}
          </button>
          {/* Primary action */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!content.trim()}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 22px", borderRadius: 9, border: "none",
              background: content.trim() ? accentColor : (isDark ? "#2a2622" : "#e8e2d8"),
              color: content.trim() ? "#fff" : textMuted,
              fontSize: 13, fontWeight: 700, cursor: content.trim() ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans',sans-serif",
              boxShadow: content.trim() ? `0 2px 14px ${accentColor}40` : "none",
              transition: "all 0.2s ease"
            }}
          >
            <Icons.Send />
            {isSubmit ? "Submit" : "Publish Task"}
          </button>
        </div>
      </div>

      {/* Confirmation toast */}
      {showConfirm && (
        <div style={{
          position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 100,
          background: isDark ? "#252320" : "#fffdf8", border: `1px solid ${borderColor}`,
          borderRadius: 12, padding: "18px 24px", boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", gap: 14, width: 360, maxWidth: "90%",
          animation: "fadeIn 0.15s ease"
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: "'DM Sans',sans-serif" }}>
            {isSubmit ? "Submit this assignment?" : "Publish this task?"}
          </div>
          <div style={{ fontSize: 12.5, color: textSecondary, lineHeight: 1.6 }}>
            {isSubmit
              ? "Your submission will be sent to the teacher for review. You can resubmit later if needed."
              : "This task will be visible to all students in the class immediately."}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowConfirm(false)} style={{
              padding: "8px 18px", borderRadius: 8, border: `1px solid ${borderColor}`,
              background: "transparent", color: textSecondary, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif"
            }}>Cancel</button>
            <button onClick={() => { setShowConfirm(false); onBack(); }} style={{
              padding: "8px 22px", borderRadius: 8, border: "none",
              background: accentColor, color: "#fff", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              boxShadow: `0 2px 10px ${accentColor}30`
            }}>
              {isSubmit ? "Confirm Submit" : "Confirm Publish"}
            </button>
          </div>
        </div>
      )}

      {/* Body: Editor + Sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: isMobile ? "column" : "row", position: "relative" }}>
        {/* Editor main area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Toolbar */}
          {!previewMode && (
            <div style={{
              padding: "8px 20px", borderBottom: `1px solid ${borderColor}`,
              display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
              background: isDark ? "#1a1816" : "#faf7f2", flexShrink: 0
            }}>
              {toolbarItems.map((item, i) =>
                item.sep ? (
                  <div key={i} style={{ width: 1, height: 18, background: borderColor, margin: "0 6px" }} />
                ) : (
                  <button key={i} onClick={item.action} title={item.label} style={{
                    width: 32, height: 32, borderRadius: 7, border: "none",
                    background: "transparent", color: textSecondary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.1s ease", padding: 0
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = isDark ? "#2a2622" : "#ede8df"; e.currentTarget.style.color = accentColor; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textSecondary; }}
                  >{item.icon}</button>
                )
              )}
            </div>
          )}

          {/* Textarea or Preview */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {previewMode ? (
              <div style={{ padding: "28px 32px", maxWidth: 720 }}>
                {content.trim() ? (
                  <MarkdownRenderer content={content} isDark={isDark} themeColor={accentColor} />
                ) : (
                  <p style={{ color: textMuted, fontStyle: "italic", fontSize: 14 }}>Nothing to preview yet. Start writing in the editor.</p>
                )}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={isSubmit
                  ? "Write your submission here...\n\nYou can use Markdown for formatting:\n**bold**, *italic*, `code`, ## headings, etc."
                  : "Write the task body here...\n\nUse Markdown for rich content:\n## Section heading\n- Bullet points\n1. Numbered lists\n> Blockquotes\n```code blocks```"}
                style={{
                  width: "100%", height: "100%", padding: "28px 32px",
                  border: "none", background: "transparent", resize: "none",
                  fontSize: 14.5, lineHeight: 1.9, color: textPrimary,
                  fontFamily: "'SF Mono','Fira Code','Cascadia Code','DM Sans',monospace",
                  outline: "none", boxSizing: "border-box"
                }}
              />
            )}
          </div>

          {/* Status bar */}
          <div style={{
            padding: "8px 24px", borderTop: `1px solid ${borderColor}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 11, color: textMuted, fontFamily: "'DM Sans',sans-serif", flexShrink: 0,
            background: isDark ? "#1a1816" : "#faf7f2"
          }}>
            <span>{wordCount} word{wordCount !== 1 ? "s" : ""} · Markdown supported</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: content.trim() ? "#5B8C6A" : textMuted }} />
              {content.trim() ? "Draft saved" : "Empty"}
            </span>
          </div>
        </div>

        {/* Attachment sidebar */}
        <div style={{
          width: isMobile ? "100%" : 260, flexShrink: 0,
          borderLeft: isMobile ? "none" : `1px solid ${borderColor}`,
          borderTop: isMobile ? `1px solid ${borderColor}` : "none",
          background: sidebarBg, display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "16px 16px 10px", fontSize: 11, fontWeight: 700, color: textMuted,
            textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans',sans-serif"
          }}>
            Attachments ({attachments.length})
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={handleMockUpload}
            style={{
              margin: "0 12px 8px", padding: "20px 14px",
              borderRadius: 10,
              border: `2px dashed ${dragOver ? accentColor : (isDark ? "#3a3630" : "#ddd5c8")}`,
              background: dragOver ? `${accentColor}10` : "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              cursor: "pointer", transition: "all 0.2s ease"
            }}
          >
            <div style={{ color: dragOver ? accentColor : textMuted, transition: "color 0.2s ease" }}>
              <Icons.Upload />
            </div>
            <div style={{ fontSize: 11.5, color: dragOver ? accentColor : textSecondary, fontWeight: 500, textAlign: "center", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
              {dragOver ? "Drop files here" : "Drag & drop files here"}
            </div>
            <span style={{ fontSize: 10, color: textMuted }}>or click to browse</span>
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
            {attachments.map(att => {
              const fColor = getFileColor(att.name);
              return (
                <div key={att.id} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 10px", borderRadius: 8, marginBottom: 3,
                  transition: "background 0.1s ease"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? "#252320" : "#ede8df"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 7,
                    background: `${fColor}15`, color: fColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0
                  }}>{getFileIcon(att.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: textPrimary,
                      fontFamily: "'DM Sans',sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>{att.name}</div>
                    <div style={{ fontSize: 10, color: textMuted, marginTop: 1 }}>{att.size}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }} style={{
                    width: 24, height: 24, borderRadius: 6, border: "none", flexShrink: 0,
                    background: "transparent", color: textMuted,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0, transition: "all 0.1s"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#c45c5c"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = textMuted; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
            {attachments.length === 0 && (
              <div style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: textMuted, fontStyle: "italic" }}>
                No files attached yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClassroomApp() {
  const [isDark, setIsDark] = useState(false);
  const [activeClass, setActiveClass] = useState("home");
  const [activeView, setActiveView] = useState("gantt");
  const [ganttRange, setGanttRange] = useState("1month");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [filters, setFilters] = useState({ unfinished: false, notSubmitted: false, showSubmitted: false, overdue: false });
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPostTask, setShowPostTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editorState, setEditorState] = useState(null); // { mode: "submit"|"publish", task?, classId, postData? }
  const userMenuTimeout = useRef(null);

  useEffect(() => {
    const check = () => { const m = window.innerWidth < 768; setIsMobile(m); if (!m) setSidebarOpen(false); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const themeColor = activeClass === "home" || activeClass === "personal" ? "#7B6CB0" : CLASS_THEMES[activeClass]?.color || "#7B6CB0";
  const currentClassName = activeClass === "home" ? "Homepage" : activeClass === "personal" ? "Personal Space" : CLASS_THEMES[activeClass]?.name || "";

  const filteredTasks = useMemo(() => {
    let t = [...TASKS_DATA];
    if (activeClass !== "home" && activeClass !== "personal") t = t.filter(task => task.classId === activeClass);
    if (filters.unfinished) t = t.filter(task => task.status !== "submitted");
    if (filters.notSubmitted) t = t.filter(task => task.status !== "submitted");
    if (!filters.showSubmitted) t = t.filter(task => task.status !== "submitted");
    if (filters.overdue) t = t.filter(task => task.status === "overdue");
    return t;
  }, [activeClass, filters]);

  const bg = isDark ? "#1a1816" : "#faf7f2";
  const sidebarBg = isDark ? "#141210" : "#f5f1ea";
  const textPrimary = isDark ? "#e8e2d8" : "#2c2825";
  const textSecondary = isDark ? "#888078" : "#8a8078";
  const textMuted = isDark ? "#5a5550" : "#c0b8ad";
  const borderColor = isDark ? "#2a2622" : "#e8e2d8";
  const cardBg = isDark ? "#1e1c1a" : "#fffdf8";

  const handleUserMenuEnter = () => { clearTimeout(userMenuTimeout.current); setShowUserMenu(true); };
  const handleUserMenuLeave = () => { userMenuTimeout.current = setTimeout(() => setShowUserMenu(false), 200); };
  const handleClassSwitch = (id) => { setActiveClass(id); setEditorState(null); if (isMobile) setSidebarOpen(false); };

  const breadcrumb = activeClass === "home" ? ["Homepage"] : activeClass === "personal" ? ["Personal Space"] : [currentClassName];

  const sidebarContent = (
    <aside style={{ width: isMobile ? 280 : 260, height: "100%", display: "flex", flexDirection: "column", background: sidebarBg, borderRight: isMobile ? "none" : `1px solid ${borderColor}`, transition: "background 0.3s ease", overflow: "hidden" }}>
      {/* User row with dark mode toggle */}
      <div onMouseEnter={!isMobile ? handleUserMenuEnter : undefined} onMouseLeave={!isMobile ? handleUserMenuLeave : undefined} style={{ position: "relative", padding: "20px 14px 12px" }}>
        <div onClick={isMobile ? () => setShowUserMenu(v => !v) : undefined} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 10, cursor: "pointer", background: showUserMenu ? (isDark ? "#2a2622" : "#ece7de") : "transparent", transition: "background 0.2s ease" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 600, flexShrink: 0, transition: "background 0.3s ease" }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, lineHeight: 1.3 }}>Alex Chen</div>
            <div style={{ fontSize: 10.5, color: textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>alex.chen@school.edu</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setIsDark(!isDark); }} title={isDark ? "Light Mode" : "Dark Mode"} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${isDark ? "#3a3630" : borderColor}`, background: isDark ? "#2a2622" : "#fffdf8", color: textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s ease", padding: 0 }}>
            {isDark ? <Icons.Sun /> : <Icons.Moon />}
          </button>
        </div>
        {showUserMenu && (
          <div onMouseEnter={!isMobile ? handleUserMenuEnter : undefined} onMouseLeave={!isMobile ? handleUserMenuLeave : undefined} style={{ position: "absolute", left: 14, right: 14, top: "100%", zIndex: 50, background: isDark ? "#222" : "#fffdf8", border: `1px solid ${borderColor}`, borderRadius: 10, padding: 6, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", animation: "fadeIn 0.12s ease" }}>
            {[{ icon: <Icons.Settings />, label: "Settings" }, { icon: <Icons.LogOut />, label: "Log Out" }].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, cursor: "pointer", color: item.label === "Log Out" ? "#c45c5c" : textSecondary, fontSize: 13, fontWeight: 500, transition: "background 0.1s ease" }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? "#2a2622" : "#f5f1ea"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {item.icon}<span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: "0 10px", overflowY: "auto" }}>
        {[{ id: "home", icon: <Icons.Home />, label: "Homepage" }, { id: "personal", icon: <Icons.Notebook />, label: "Personal Space" }].map(item => (
          <div key={item.id} onClick={() => handleClassSwitch(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2, fontSize: 13, fontWeight: activeClass === item.id ? 600 : 400, color: activeClass === item.id ? themeColor : textSecondary, background: activeClass === item.id ? (isDark ? `${themeColor}15` : `${themeColor}10`) : "transparent", transition: "all 0.15s ease" }}
            onMouseEnter={e => { if (activeClass !== item.id) e.currentTarget.style.background = isDark ? "#2a2622" : "#ece7de" }}
            onMouseLeave={e => { if (activeClass !== item.id) e.currentTarget.style.background = "transparent" }}>
            {item.icon}<span>{item.label}</span>
          </div>
        ))}
        <div style={{ height: 1, background: borderColor, margin: "12px 12px" }} />
        <div style={{ padding: "4px 12px 8px", fontSize: 10, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Joined Classes</div>
        {Object.entries(CLASS_THEMES).map(([id, cls]) => (
          <div key={id} onClick={() => handleClassSwitch(id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 1, fontSize: 13, fontWeight: activeClass === id ? 600 : 400, color: activeClass === id ? cls.color : textSecondary, background: activeClass === id ? (isDark ? `${cls.color}15` : `${cls.color}10`) : "transparent", transition: "all 0.15s ease" }}
            onMouseEnter={e => { if (activeClass !== id) e.currentTarget.style.background = isDark ? "#2a2622" : "#ece7de" }}
            onMouseLeave={e => { if (activeClass !== id) e.currentTarget.style.background = "transparent" }}>
            <div style={{ width: 8, height: 8, borderRadius: 3, background: cls.color, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cls.name}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding: "12px 12px 16px", borderTop: `1px solid ${borderColor}`, display: "flex", gap: 8 }}>
        <button onClick={() => setShowJoinModal(true)} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 9, border: "none", background: themeColor, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.3s ease", boxShadow: `0 2px 12px ${themeColor}40` }}>
          <Icons.Link /> Join Class
        </button>
        <button onClick={() => setShowCreateModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "10px 0", borderRadius: 9, border: `1.5px solid ${isDark ? "#3a3630" : borderColor}`, background: "transparent", color: textSecondary, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s ease" }}>
          <Icons.Plus /> Create
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500;8..60,600;8..60,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${isDark ? "#333" : "#ddd5c8"}; border-radius:10px; }
        ::selection { background:${themeColor}30; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { transform:translateX(-100%); } to { transform:translateX(0); } }
        @keyframes fadeOverlay { from { opacity:0; } to { opacity:1; } }
      `}</style>

      {showCreateModal && <CreateClassModal onClose={() => setShowCreateModal(false)} isDark={isDark} />}
      {showJoinModal && <JoinClassModal onClose={() => setShowJoinModal(false)} isDark={isDark} themeColor={themeColor} />}
      <PostTaskOverlay
        visible={showPostTask}
        onClose={() => setShowPostTask(false)}
        isDark={isDark}
        themeColor={themeColor}
        className={currentClassName}
        onEditBody={(postData) => {
          setShowPostTask(false);
          setEditorState({ mode: "publish", classId: activeClass, postData });
        }}
      />
      {selectedTask && (
        <TaskDetailOverlay
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          isDark={isDark}
          themeColor={themeColor}
          onSubmit={(task) => {
            setSelectedTask(null);
            setEditorState({ mode: "submit", task, classId: task.classId });
          }}
        />
      )}

      <div style={{ display: "flex", height: "100vh", width: "100vw", fontFamily: "'DM Sans', sans-serif", background: bg, color: textPrimary, transition: "all 0.3s ease" }}>
        {!isMobile && sidebarContent}

        {/* Mobile floating sidebar */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", animation: "fadeOverlay 0.2s ease" }}>
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", left: 0, top: 0, bottom: 0, boxShadow: "4px 0 24px rgba(0,0,0,0.15)", animation: "slideIn 0.25s ease", borderRadius: "0 16px 16px 0", overflow: "hidden" }}>
              <button onClick={() => setSidebarOpen(false)} style={{ position: "absolute", top: 16, right: 12, zIndex: 10, width: 30, height: 30, borderRadius: 8, border: "none", background: isDark ? "#2a2622" : "#ece7de", color: textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icons.X /></button>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* MAIN */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Breadcrumb */}
          {!editorState && (
            <div style={{ padding: isMobile ? "12px 16px" : "14px 32px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: textMuted, fontWeight: 500, background: isDark ? "#1a1816" : "#faf7f2", transition: "all 0.3s ease" }}>
              {isMobile && (
                <button onClick={() => setSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${borderColor}`, background: "transparent", color: textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginRight: 4, padding: 0 }}>
                  <Icons.Menu />
                </button>
              )}
              <span style={{ cursor: "pointer", color: textSecondary }} onClick={() => { setActiveClass("home"); setEditorState(null); }}>Classroom</span>
              {breadcrumb.map((b, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.ChevronRight />
                  <span style={{ color: i === breadcrumb.length - 1 ? themeColor : textSecondary, fontWeight: i === breadcrumb.length - 1 ? 600 : 500, transition: "color 0.3s ease" }}>{b}</span>
                </span>
              ))}
            </div>
          )}

          {/* Editor Page or Normal Content */}
          {editorState ? (
            <EditorPage
              editorState={editorState}
              onBack={() => setEditorState(null)}
              isDark={isDark}
              themeColor={themeColor}
              isMobile={isMobile}
            />
          ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 16px 32px" : "28px 40px 40px" }}>
            <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 700, color: textPrimary, fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 4 }}>
                  {activeClass !== "home" && activeClass !== "personal" && (
                    <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 4, background: themeColor, marginRight: 14, verticalAlign: "middle", position: "relative", top: -2, transition: "background 0.3s ease" }} />
                  )}
                  {currentClassName}
                </h1>
                {activeClass === "home" && <p style={{ fontSize: 14, color: textSecondary, fontWeight: 400, marginTop: 4 }}>Overview of all your tasks across every class.</p>}
              </div>
              {activeClass !== "home" && activeClass !== "personal" && (
                <button
                  onClick={() => setShowPostTask(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 9, border: "none",
                    background: themeColor, color: "#fff",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif",
                    transition: "all 0.3s ease",
                    boxShadow: `0 2px 12px ${themeColor}40`,
                    flexShrink: 0, marginTop: 4, whiteSpace: "nowrap"
                  }}
                >
                  <Icons.Plus /> Post Task
                </button>
              )}
            </div>

            {/* View Switcher + Filters */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${borderColor}` }}>
              <div style={{ display: "flex", gap: 4, background: isDark ? "#222" : "#f0ece4", borderRadius: 9, padding: 3 }}>
                {[{ id: "gantt", icon: <Icons.Gantt />, label: "Gantt Chart" }, { id: "list", icon: <Icons.List />, label: "List" }].map(v => (
                  <button key={v.id} onClick={() => setActiveView(v.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: "none", background: activeView === v.id ? (isDark ? "#1a1816" : cardBg) : "transparent", color: activeView === v.id ? themeColor : textSecondary, fontSize: 12, fontWeight: activeView === v.id ? 600 : 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: activeView === v.id ? "0 1px 4px rgba(0,0,0,0.06)" : "none", transition: "all 0.15s ease" }}>
                    {v.icon}{v.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <div style={{ color: textMuted, marginRight: 4 }}><Icons.Filter /></div>
                {[{ key: "unfinished", label: "Unfinished" }, { key: "notSubmitted", label: "Not Submitted" }, { key: "overdue", label: "Overdue" }].map(f => (
                  <button key={f.key} onClick={() => setFilters(p => ({ ...p, [f.key]: !p[f.key] }))} style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${filters[f.key] ? themeColor : (isDark ? "#3a3630" : borderColor)}`, background: filters[f.key] ? `${themeColor}15` : "transparent", color: filters[f.key] ? themeColor : textSecondary, fontSize: 11, fontWeight: filters[f.key] ? 600 : 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s ease" }}>
                    {f.label}
                  </button>
                ))}
                <div style={{ width: 1, height: 16, background: borderColor, margin: "0 4px" }} />
                <button onClick={() => setFilters(p => ({ ...p, showSubmitted: !p.showSubmitted }))} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${filters.showSubmitted ? themeColor : (isDark ? "#3a3630" : borderColor)}`, background: filters.showSubmitted ? `${themeColor}15` : "transparent", color: filters.showSubmitted ? themeColor : textSecondary, fontSize: 11, fontWeight: filters.showSubmitted ? 600 : 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s ease" }}>
                  <Icons.Check /> Show Submitted
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: isMobile ? 10 : 16, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { label: "Total Tasks", count: filteredTasks.length, color: themeColor },
                { label: "In Progress", count: filteredTasks.filter(t => t.status === "in-progress").length, color: "#5B8C6A" },
                { label: "Overdue", count: filteredTasks.filter(t => t.status === "overdue").length, color: "#c45c5c" },
                { label: "Not Started", count: filteredTasks.filter(t => t.status === "not-started").length, color: textMuted },
              ].map((s, i) => (
                <div key={i} style={{ padding: isMobile ? "12px 14px" : "14px 20px", borderRadius: 10, background: cardBg, border: `1px solid ${borderColor}`, minWidth: isMobile ? 0 : 130, flex: isMobile ? "1 1 calc(50% - 6px)" : undefined, transition: "all 0.3s ease" }}>
                  <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: s.color, fontFamily: "'Source Serif 4',Georgia,serif", transition: "color 0.3s ease" }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: textSecondary, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Content card */}
            <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", transition: "all 0.3s ease" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: "'DM Sans',sans-serif" }}>
                  {activeClass === "home" ? "All Tasks" : `${currentClassName} Tasks`}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {activeView === "gantt" && (
                    <div style={{ display: "flex", gap: 3, background: isDark ? "#252320" : "#f0ece4", borderRadius: 7, padding: 2 }}>
                      {[{ id: "week", label: "Week" }, { id: "1month", label: "1 Month" }, { id: "2month", label: "2 Months" }].map(r => (
                        <button key={r.id} onClick={() => setGanttRange(r.id)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: ganttRange === r.id ? (isDark ? "#1a1816" : "#fffdf8") : "transparent", color: ganttRange === r.id ? themeColor : textSecondary, fontSize: 11, fontWeight: ganttRange === r.id ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: ganttRange === r.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none", transition: "all 0.15s ease" }}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {filteredTasks.length > 0 ? (
                activeView === "gantt"
                  ? <GanttChart tasks={filteredTasks} activeClass={activeClass} isDark={isDark} themeColor={themeColor} ganttRange={ganttRange} onTaskClick={setSelectedTask} />
                  : <ListView tasks={filteredTasks} activeClass={activeClass} isDark={isDark} themeColor={themeColor} onTaskClick={setSelectedTask} />
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: textMuted, fontSize: 13 }}>No tasks match the current filters.</div>
              )}
            </div>

            {activeClass === "home" && (
              <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", padding: "0 4px" }}>
                {Object.entries(CLASS_THEMES).map(([id, cls]) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 3, background: cls.color }} />
                    {cls.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </main>
      </div>
    </>
  );
}
