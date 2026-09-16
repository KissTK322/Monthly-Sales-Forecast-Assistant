# Prompts for Claude Code

Copy one prompt at a time into the Claude Code panel. Wait for the result, review it, then send the next one.
Replace `<N>` with the phase number.

---

## 1. Kickoff (first message)

```text
Read CLAUDE.md first, then prd.md, AGENTS.md, architecture.md, schema.md,
implementation-plan.md and progress.md. Skim reference/client-meeting-notes.md,
reference/vibe-coding-workshop.pdf (slides 27-29, 34-40, 54-60),
reference/prototype-monthly-sales-forecast.html and reference/sales-compass-pwa/.
Do not read private-data/ yet and do not write any code.

Then reply with:
1. Your understanding of the product in 10 lines or fewer.
2. Every conflict you find between the six documents, CLAUDE.md §4 and the prototype.
3. Questions you need answered before Phase 0.
4. Confirm which subagents in .claude/agents/ you will use in each phase.
Stop and wait for my answers.
```

## 2. Phase 0 — update the documents

```text
Start Phase 0 from CLAUDE.md. Use the architect-reviewer subagent to plan,
and docs-i18n for wording.

Update the six documents for the requirements in CLAUDE.md §4:
- prd.md → v1.3: new FR/NFR for PWA, supported platforms and browsers,
  responsive layout, Excel file picking on phones/tablets, Thai/English,
  light/dark/system theme, eco budget; update tech constraints and out of scope;
  move the prototype-only features (daily sales entry, add product/customer,
  tech-team role) to an M8+ list; add a change log.
- architecture.md: PWA layer, file layout, service worker/update flow,
  worker-based import, storage, eco budget, GitHub Pages paths.
- Data source change: the three Express CSV reports in private-data/
  (cash sales, credit sales, deposit receipts; see CLAUDE.md §7) replace the
  single July Excel file. Update PRD sources, FRs, success criteria and open
  questions (9 months of history, credit customers without codes, SR deposit
  documents, whether .xlsx import is still needed).
- schema.md: add channel (cash/credit), invoice discount, VAT, due date,
  collected flag, sales-order ref, deposit receipts and deposit-to-invoice
  links; note that grossAmount = netAmount + deposits.
- AGENTS.md: working tool is Claude Code with the subagents in .claude/agents/.
- implementation-plan.md: add the PWA/eco checks to M0, M6 and Deploy;
  fix "at least these five" (six cases are listed).
- progress.md: add a dated entry for this change.
- Set every "PRD baseline" line to 1.3 with today's date.

Show me the changes as diffs, then stop. Do not touch app code.
```

## 3. Start a build phase (Phase 1 to 9)

```text
Start Phase <N> from CLAUDE.md (milestone in the table).
First use architect-reviewer to write a short plan: files to create/change,
which subagent does each part, and the acceptance checks.
Show me the plan and wait for "approve".
```

After you reply "approve":

```text
approve. Build Phase <N> with the planned subagents.
When done, run the qa-tester subagent and architect-reviewer review,
fix blocking issues, update the phase status in CLAUDE.md,
and reply with the end-of-phase report from CLAUDE.md §9. Then stop.
```

## 4. Phase 3 only — check against the real files

```text
Run the three importers locally against private-data/cash-sales.csv,
private-data/credit-sales.csv and private-data/deposits.csv.
Report only counts and pass/fail against each report footer and the targets
in CLAUDE.md §7 (invoices, lines, codes, customers, salespeople, no-price lines,
deposit notes and links; goods/VAT/total/deposit/before-deposit match: yes/no).
Do not print customer names, phone numbers or money totals.
Do not copy the files anywhere.
```

## 5. When something is wrong

```text
In Phase <N>, <what I did> → expected <X>, got <Y>.
Console/terminal output: <paste>.
Explain the cause first, then fix only that problem and re-run the related checks.
```

## 6. Review before commit

```text
Use architect-reviewer to review all changes since the last commit:
correctness, edge cases, security, accessibility, responsive, eco budget,
and scope against prd.md. List issues by severity. Do not edit files.
Then write a one-line commit message in the form "[Mxx] short description".
```

## 7. Explain for the viva

```text
Explain <file or function> line by line in simple Thai, as if to a first-year
student, with one worked example. I need to defend it to the instructor.
```
