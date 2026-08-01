
================================================================================
Test Case ID: TC-M3.1-01
Phase: 3 - Reporting
Milestone ID: M3.1
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.1-01
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: KPIs: schedule, milestone, risk, budget, workload, utilisation, timesheet, collection
Preconditions: UAT environment deployed via CI/CD. Dependent milestone(s) are built and deployed to UAT. Tester is authenticated in the role: 'PMO Lead' (using matching account in Test Data Register). Portfolio contains Active projects with milestones, tasks, and (where applicable) financial data. Required mock/sandbox records exist.
Test Steps: 1. Log in to the PMO Platform as a PMO Lead via EntraID SSO.
2. Navigate to Dashboard (/dashboard). Confirm Executive Dashboard / Portfolio Overview is the default tab.
3. On Portfolio Overview, confirm KPI cards load (projects/progress, at-risk, and budget KPIs when financials.view is granted).
4. Open Execution Health and confirm Project Health table and milestone widgets load.
5. Open People & Resources and confirm utilisation / workload widgets load.
6. Optional: open Settings -> Health rules and confirm RAG dimensions (schedule, cost, risk, resources, collections) are configured.
7. Capture screenshots of KPI row and health widgets.
Expected Result: Dashboard KPIs and widgets load for schedule/progress, milestones, budget (if permitted), workload/utilisation, and related portfolio signals. Data is scoped by the user's project record-scope. No permission errors for PMO Lead with reports/projects view.
Evidence to Capture: UAT UI screenshots of Dashboard Portfolio / Execution / People tabs with KPI and health widgets.

================================================================================
Test Case ID: TC-M3.1-02
Phase: 3 - Reporting
Milestone ID: M3.1
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.1-02
Use Case ID: UC-08
Category: Negative
Priority: High
Test Scenario: Role-based access enforced
Preconditions: UAT environment deployed via CI/CD. Dependent milestone(s) are built and deployed to UAT. Test accounts exist for Engineer, PM (projects.view with own_projects), and PMO Lead (projects.view with all). At least one project owned by the PM and one project owned by another PM exist.
Test Steps: 1. Log in as Engineer. Open Dashboard (/dashboard).
2. Confirm dashboard filters (Department / Status / Primary PM) are NOT shown and are not applied.
3. Attempt to open Reports hub paths that require reports.view (e.g. /dashboard/reports/utilization) if Engineer lacks permission - confirm access is denied / gated.
4. Log in as PM (own_projects). Open Dashboard -> Project Health / portfolio widgets.
5. Confirm only projects where the PM is Primary or Secondary PM appear (other PMs' projects are absent).
6. Log in as PMO Lead. Open Dashboard and confirm cross-project visibility (projects from multiple PMs appear).
7. Capture Engineer (no filters) vs PM (scoped) vs PMO Lead (cross-project) screenshots.
Expected Result: Engineer does not see or use dashboard portfolio filters. PM (own_projects) sees only their scoped projects on dashboard health/stats. PMO Lead (all) sees cross-project portfolio data. Unauthorised report routes remain gated.
Evidence to Capture: Screenshots: Engineer dashboard without filter bar; PM scoped project list; PMO Lead multi-PM portfolio.

================================================================================
Test Case ID: TC-M3.1-03
Phase: 3 - Reporting
Milestone ID: M3.1
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.1-03
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: Filters available
Preconditions: UAT environment deployed via CI/CD. Dependent milestone(s) are built and deployed to UAT. Tester is authenticated as 'PMO Lead' (all scope) and separately as 'PM' (own_projects). Projects span multiple departments/statuses/PMs.
Test Steps: 1. Log in as PMO Lead. Open Dashboard (/dashboard).
2. Confirm filter bar is visible: Department, Status, and Primary PM.
3. Apply Department and/or Status and/or Primary PM filters. Confirm stats, Project Health, milestones, resources, and burn-rate refresh.
4. Click Clear filters and confirm the full portfolio returns.
5. Log in as Engineer. Confirm the filter bar is not shown.
6. Log in as PM (own_projects). Confirm filters may show Department/Status but Primary PM filter is hidden; results remain limited to own projects.
7. Capture filtered vs cleared (PMO) and Engineer no-filter screenshots.
Expected Result: PMO Lead can filter the dashboard by department, status, and primary PM; Clear filters restores the full scoped portfolio. Engineer never sees dashboard filters. PM does not get a cross-PM filter and remains limited to own_projects.
Evidence to Capture: Screenshots of filter bar with applied filters, cleared view, and Engineer dashboard without filters.

================================================================================
Test Case ID: TC-M3.1-04
Phase: 3 - Reporting
Milestone ID: M3.1
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.1-04
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: Drill-down available
Preconditions: UAT environment deployed via CI/CD. Dependent milestone(s) are built and deployed to UAT. Tester is authenticated as 'PMO Lead' with projects.view. At least one project appears in Project Health.
Test Steps: 1. Log in as PMO Lead. Open Dashboard -> Execution Health / Project Health table.
2. Click a project row and confirm navigation into the project workspace / projects list with the selected project context.
3. Return to Dashboard -> People & Resources and note utilisation KPIs.
4. Open Reports -> Utilization (/dashboard/reports/utilization) for detailed drill-down.
5. Capture drill-down screenshots (health row -> project; utilisation detail).
Expected Result: Dashboard widgets provide working drill-down into project and utilisation detail views. Navigation lands on the expected project/report page without errors.
Evidence to Capture: Screenshots of Project Health drill-down and Utilization report navigation.

================================================================================
Test Case ID: TC-M3.1-05
Phase: 3 - Reporting
Milestone ID: M3.1
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.1-05
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: Real-time vs cached behaviour defined
Preconditions: UAT environment deployed via CI/CD. Dependent milestone(s) are built and deployed to UAT. Tester is authenticated as 'PMO Lead'.
Test Steps: 1. Log in as PMO Lead. Open Dashboard (/dashboard).
2. Note the Live / As-of freshness badge near Reload.
3. Click Reload and confirm APIs refetch and the As-of timestamp updates.
4. Confirm data freshness source shows live for dashboard endpoints.
5. Capture Live/As-of badge screenshot before and after Reload.
Expected Result: Dashboard freshness is visible (Live / As-of). Reload refreshes live data and updates the As-of time. Real-time vs snapshot behaviour is observable to the tester.
Evidence to Capture: Screenshots of freshness badge before/after Reload.

================================================================================
Test Case ID: TC-M3.2-01
Phase: 3 - Reporting
Milestone ID: M3.2
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.2-01
Use Case ID: UC-09
Category: Positive
Priority: Critical
Test Scenario: RAG rules for schedule, cost, risk, resources, collections
Preconditions: UAT environment deployed via CI/CD. Dependent milestone(s) are built and deployed to UAT. Tester is authenticated as 'PMO Lead' (or admin with reports access). Health rules are seeded or configurable.
Test Steps: 1. Log in as PMO Lead / admin.
2. Open Settings -> Health rules and confirm dimensions exist: schedule, cost, risk, resources, collections.
3. Evaluate a known project (UI health widget or GET /reports/health/projects/{id}).
4. Confirm each dimension returns score + ragStatus (green/amber/red) and an overall RAG.
5. Confirm RAG colours/labels appear consistently on the health evaluation UI/response.
6. Capture health evaluation evidence.
Expected Result: RAG rules exist for schedule, cost, risk, resources, and collections. Project evaluation returns per-dimension score/RAG and overall RAG consistent with the rulebook.
Evidence to Capture: Health rules list + project health evaluation UI/API evidence.

================================================================================
Test Case ID: TC-M3.2-02
Phase: 3 - Reporting
Milestone ID: M3.2
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.2-02
Use Case ID: UC-09
Category: Positive
Priority: Critical
Test Scenario: Rules configurable
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'Super Admin' or a user with reports.manage / settings permission to edit health rules.
Test Steps: 1. Log in as Super Admin
2. Open Settings -> Health rules.
3. Edit green/amber/red thresholds for at least two dimensions.
4. Save and confirm the update succeeds (rules version/active set updates).
5. Re-evaluate a project and confirm new thresholds affect ragStatus.
6. Capture before/after threshold screenshots.
Expected Result: Health rule thresholds are configurable and persist. Re-evaluation uses the updated thresholds (RAG status can change when source scores cross new boundaries).
Evidence to Capture: Before/after health rule screenshots and re-evaluation result.

================================================================================
Test Case ID: TC-M3.2-03
Phase: 3 - Reporting
Milestone ID: M3.2
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.2-03
Use Case ID: UC-09
Category: Positive
Priority: Critical
Test Scenario: Calculations reconcile to source records
Preconditions: UAT environment deployed via CI/CD. An Active project exists with tasks, milestones, budget/spend or invoices, and allocations. Tester is authenticated as 'PMO Lead' or 'PM' with access to that project.
Test Steps: 1. Pick an Active project with known source data (tasks, milestones, budget, allocations).
2. Open project health evaluation (dashboard health page).
3. Manually compare dimension values to source UI/records (task progress/overdue, milestones done, spend vs budget, open high/critical items, allocation %, collections).
4. Change a source fact (e.g. complete a milestone or approve timesheets) and re-evaluate.
5. Confirm scores/RAG move in the expected direction.
6. Capture evaluation evidence alongside source screenshots.
Expected Result: Health calculations reconcile to source project records. Changing source data changes the corresponding dimension score/RAG on re-evaluation.
Evidence to Capture: Health evaluation evidence + source data screenshots before/after a controlled change.

================================================================================
Test Case ID: TC-M3.3-01
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-01
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Weekly report renders in approved CyberSec format
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM' or 'PMO Lead' with reports.manage. A project with milestones/actions exists. Interim CyberSec sample template is deployed (official letterhead may still be pending).
Test Steps: 1. Log in as PM/PMO with reports.manage.
2. Navigate to Reports -> Status Reports (/dashboard/reports/status).
3. Select a project, choose Weekly (WSR), click Generate.
4. Open the generated report preview (click the report row).
5. Confirm the preview is a user-friendly layout with status/RAG header, Project health, Milestones, Open action points, Data quality issues.
6. Export PDF and DOCX from the report actions.
7. Confirm interim CyberSec sample branding (header, confidentiality, sections: health, milestones, actions, missing data).
8. Capture preview + PDF/DOCX samples.
Expected Result: Weekly Status Report (WSR) generates as Draft, opens in a readable preview UI (not JSON dump), and exports PDF/DOCX using the interim CyberSec sample format with the agreed sections.
Evidence to Capture: WSR preview screenshots + PDF/DOCX sample attachments.

================================================================================
Test Case ID: TC-M3.3-02
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-02
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Monthly report renders in approved CyberSec format
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM' or 'PMO Lead' with reports.manage. A project suitable for MSR generation exists.
Test Steps: 1. Log in as PM/PMO with reports.manage.
2. Open Status Reports; select project; choose Monthly (MSR); Generate.
3. Open preview and confirm readable sections (health, milestones, actions, missing data) and monthly period label.
4. Export PDF and DOCX.
5. Confirm MSR title/period and the same CyberSec sample section layout as WSR.
6. Capture MSR preview + PDF/DOCX samples.
Expected Result: Monthly Status Report (MSR) generates, previews in user-friendly UI, and exports PDF/DOCX with CyberSec sample branding and monthly period labelling.
Evidence to Capture: MSR preview screenshots + PDF/DOCX sample attachments.

================================================================================
Test Case ID: TC-M3.3-03
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-03
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Agreed sections included
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM'/'PMO Lead'. Target project has milestones, open action points, and optionally open data-quality flags.
Test Steps: 1. Generate a WSR for a project that has milestones, open action points, and (optionally) DQ flags.
2. Open report preview (/dashboard/reports/status/{id}).
3. Confirm sections are rendered: Project health, Milestones, Open action points, Data quality issues (plus header meta: status, overall RAG, period, generated time).
4. Export PDF/DOCX and confirm corresponding section headings are present.
5. Capture preview + export screenshots.
Expected Result: Agreed WSR/MSR sections appear in both the friendly preview UI and exported PDF/DOCX (health, milestones, actions, missing/data-quality).
Evidence to Capture: Preview and export screenshots showing all agreed sections.

================================================================================
Test Case ID: TC-M3.3-04
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-04
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Missing data flagged
Preconditions: UAT environment deployed via CI/CD. Unresolved Data Quality flags exist for the project (or can be created via Reports -> Data Quality -> Scan). Tester is authenticated as 'PM'/'PMO Lead'.
Test Steps: 1. Ensure unresolved Data Quality flags exist for the project (run Data Quality scan if needed).
2. Generate WSR/MSR for that project.
3. In preview, open Data quality issues and confirm flag type, severity, and description are listed.
4. Resolve flags on Data Quality page (/dashboard/reports/data-quality), regenerate the report, and confirm missing-data content clears or reduces.
5. Capture report missing-data / DQ section screenshots.
Expected Result: Unresolved DQ flags appear in the report missing-data / Data quality issues section. After resolution and regeneration, the section updates accordingly.
Evidence to Capture: Screenshots of DQ flags in report preview before/after resolve + regenerate.

================================================================================
Test Case ID: TC-M3.3-05
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-05
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: PM approval before distribution
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM' with reports.manage. An Active Report Schedule with recipients exists for the project (or Primary PM fallback is acceptable). Mailer is configured for UAT.
Test Steps: 1. Generate a WSR (status Draft).
2. Confirm only the Draft flow action is available (Approve). Distribute is not available while Draft.
3. Click Approve - status becomes Approved (badge updates).
4. Click Distribute - status becomes Distributed; recipients receive email with subject like 'WSR - {project}' / 'MSR - {project}', body notice, and PDF attachment.
5. Confirm email is sent only on Distribute (not on Draft/Approve).
6. Capture Draft -> Approved -> Distributed UI flow and email evidence.
Expected Result: PM must Approve before Distribute. Distribute sets status to Distributed and emails recipients with the status-report PDF. Draft/Approve do not send the distribution email.
Evidence to Capture: UI status flow screenshots + email with PDF attachment evidence.

================================================================================
Test Case ID: TC-M3.3-06
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-06
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Export to PDF and DOCX
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM'/'PMO Lead'. At least one Draft, Approved, or Distributed status report exists.
Test Steps: 1. Open Status Reports (/dashboard/reports/status).
2. For a Draft/Approved/Distributed report, use Export and download PDF, DOCX, Excel (.xlsx), and CSV.
3. Open each file and confirm health/milestones/actions/missing-data content is present.
4. Confirm Excel uses discrete sheets (Health, Milestones, Actions, MissingData) where implemented.
5. Capture/attach the exported files as evidence.
Expected Result: Status reports can be exported to PDF, DOCX, Excel, and CSV from the UI. File contents match the report snapshot sections.
Evidence to Capture: Exported PDF/DOCX/XLSX/CSV attachments verified for layout and values.

================================================================================
Test Case ID: TC-M3.3-07
Phase: 3 - Reporting
Milestone ID: M3.3
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13
Checkpoint ID: M3.3-07
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Report version control
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM'/'PMO Lead' with reports.manage.
Test Steps: 1. Generate WSR for a project (version 1).
2. Generate again for the same project + Weekly (WSR).
3. Confirm a new row appears with version = previous + 1 and prior versions remain listed.
4. Use filters (project / status / type) and pagination if many reports exist.
5. Open both versions from the list/preview.
6. Capture version history list screenshot.
Expected Result: Regenerating the same project and report type creates a new versioned snapshot; older versions remain available. List filters/pagination still work with multiple versions.
Evidence to Capture: Screenshot of status reports list showing v1 and v2 (or higher) for the same project/type.

================================================================================
Test Case ID: TC-M3.4-01
Phase: 3 - Reporting
Milestone ID: M3.4
Current Milestone ID: P3.16, P3.17, P3.18
Checkpoint ID: M3.4-01
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: Meeting captures agenda, attendees, decisions and action points
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PM' (or role with project edit). Project has team assignees available as attendees.
Test Steps: 1. Open a project workspace -> Meetings & MoM tab.
2. Click Meeting; enter title and scheduled datetime.
3. Select attendees from project team/assignees (include at least one Engineer for later MoM ack tests).
4. Add Agenda items, Decisions, and Actions (with owners).
5. Save/Create. Confirm the meeting appears in the Meetings accordion list (latest meeting on top).
6. Expand the meeting accordion and use View/Edit to confirm attendees + agenda/decisions/actions persist.
7. Capture form + saved meeting detail.
Expected Result: Meeting is created with attendees, agenda, decisions, and action items. Meetings appear in a nested accordion UI (latest first); only one meeting accordion is open at a time.
Evidence to Capture: Screenshots of create/edit meeting sheet and nested Meetings accordion.

================================================================================
Test Case ID: TC-M3.4-02
Phase: 3 - Reporting
Milestone ID: M3.4
Current Milestone ID: P3.16, P3.17, P3.18
Checkpoint ID: M3.4-02
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: MoM produced in CyberSec format
Preconditions: UAT environment deployed via CI/CD. A meeting with agenda/decisions/actions exists. Tester is authenticated as 'PM' with project edit.
Test Steps: 1. From Meetings & MoM, expand the meeting accordion.
2. Click Generate MoM.
3. Confirm a Draft MoM appears nested under that meeting (Minutes vN) with status Draft.
4. Export MoM PDF and DOCX from the MoM row Export menu.
5. Confirm interim CyberSec MoM layout (attendance, agenda, decisions, actions, acknowledgement note).
6. Capture MoM row + PDF/DOCX samples.
Expected Result: MoM is generated as Draft under its parent meeting and exports PDF/DOCX in the interim CyberSec sample format.
Evidence to Capture: Nested MoM screenshot + PDF/DOCX sample attachments.

================================================================================
Test Case ID: TC-M3.4-03
Phase: 3 - Reporting
Milestone ID: M3.4
Current Milestone ID: P3.16, P3.17, P3.18
Checkpoint ID: M3.4-03
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: MoM reviewed
Preconditions: UAT environment deployed via CI/CD. A Draft MoM exists under a meeting. Tester is authenticated as 'PM' with project edit.
Test Steps: 1. Expand the meeting and locate the Draft MoM.
2. Click Review.
3. Confirm status changes to Reviewed and the next action becomes Distribute.
4. Capture before/after status badges.
Expected Result: MoM workflow advances Draft -> Reviewed via the Review action. Distribute is available only after Reviewed.
Evidence to Capture: Screenshots of MoM status Draft then Reviewed.

================================================================================
Test Case ID: TC-M3.4-04
Phase: 3 - Reporting
Milestone ID: M3.4
Current Milestone ID: P3.16, P3.17, P3.18
Checkpoint ID: M3.4-04
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: MoM versioned
Preconditions: UAT environment deployed via CI/CD. A meeting exists. Tester is authenticated as 'PM' with project edit.
Test Steps: 1. Generate MoM for a meeting (v1).
2. Generate MoM again for the same meeting.
3. Confirm version increments (v2) and both documents appear nested under the same meeting.
4. Capture version list screenshot under the meeting accordion.
Expected Result: Each Generate MoM creates a new version under the same meeting; prior versions remain listed (v1, v2, ...).
Evidence to Capture: Screenshot of nested MoMs showing multiple versions under one meeting.

================================================================================
Test Case ID: TC-M3.4-05
Phase: 3 - Reporting
Milestone ID: M3.4
Current Milestone ID: P3.16, P3.17, P3.18
Checkpoint ID: M3.4-05
Use Case ID: UC-21
Category: Positive
Priority: Critical
Test Scenario: MoM shared with acknowledgement
Preconditions: UAT environment deployed via CI/CD. Mailer and in-app notifications are enabled. A Reviewed MoM exists for a meeting whose attendees include Engineer James (or equivalent Test Data Register engineer). James was an attendee at Distribute time (adding him after Distribute must NOT grant access to that MoM).
Test Steps: 1. As PM, open Meetings & MoM, expand the meeting, and click Distribute on the Reviewed MoM.
2. Confirm attendees are emailed with MoM PDF attached and a link 'Open Minutes of Meeting'.
3. Confirm each attendee receives an in-app notification to acknowledge the MoM; opening it lands on the MoM tab.
4. As PM, expand Acknowledgements accordion under the MoM and confirm pending recipients (x/y).
5. Log in as Engineer. Confirm he does NOT see the Meetings list - only Distributed MoMs he was a recipient of, nested under meeting titles.
6. Click Acknowledge; confirm the button becomes disabled labelled Acknowledged.
7. As PM, refresh Acknowledgements and confirm the engineer shows Acknowledged with timestamp.
8. Capture email, notification, engineer UI, and acknowledgements evidence.
Expected Result: Distribute emails PDF + deep link and creates in-app ack notifications. Engineers only see Distributed MoMs they received at distribute time (not meetings; no status/ack-count badges). Acknowledge disables after success. Managers see acknowledgements in an accordion. Adding an attendee after distribute does not backfill visibility for prior MoMs.
Evidence to Capture: Email with PDF + link; in-app notification; engineer MoM UI; PM acknowledgements accordion; negative evidence for late-added attendee.

================================================================================
Test Case ID: TC-M3.5-01
Phase: 3 - Reporting
Milestone ID: M3.5
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13, P3.14, P3.15
Checkpoint ID: M3.5-01
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: Export to PDF/Excel/CSV as applicable
Preconditions: UAT environment deployed via CI/CD. Tester has appropriate export permissions (reports.manage / project_export / tasks view as applicable).
Test Steps: 1. From Status Reports, export a report as PDF, DOCX, Excel, and CSV.
2. From Reports -> Utilization, export CSV.
3. From Dashboard, use Export Portfolio (xlsx/csv/pdf as permitted by role).
4. Attach exported files as evidence.
Expected Result: Applicable exports succeed for status reports, utilisation, and dashboard portfolio/tasks based on role permissions. Files open and content matches UI scope/filters.
Evidence to Capture: Exported file attachments (PDF/Excel/DOCX/CSV) verified for layout and values.

================================================================================
Test Case ID: TC-M3.5-02
Phase: 3 - Reporting
Milestone ID: M3.5
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13, P3.14, P3.15
Checkpoint ID: M3.5-02
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: Schedule to role-based recipients
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PMO Lead' (reports.manage). Internal roles exist for recipient selection. Target project has Active allocations for those roles (or Primary/Secondary PM fallback).
Test Steps: 1. Log in as PMO Lead. Open Reports -> Schedules (/dashboard/reports/schedules).
2. Click Create and complete the modal: required Project, report type WSR or MSR, friendly schedule (WSR: weekday + time; MSR: day-of-month + time), Active toggle, multi-select internal roles.
3. Save and confirm the schedule card appears with project, type, cron/summary, recipients, and Active/Inactive control.
4. Toggle Active/Inactive on the card and confirm state persists.
5. Delete with confirmation and confirm the schedule is removed.
6. Capture create modal + list/card screenshots.
Expected Result: Report schedules can be created with required project, WSR/MSR schedule inputs, and multi-role recipients. Active/Inactive toggle and delete confirmation work. Delivery remains scoped to selected roles + Active allocation (or Primary/Secondary PM) when the schedule runs.
Evidence to Capture: Screenshots of create-schedule modal, schedule cards, Active toggle, and delete confirmation.

================================================================================
Test Case ID: TC-M3.5-03
Phase: 3 - Reporting
Milestone ID: M3.5
Current Milestone ID: P3.08, P3.09, P3.10, P3.11, P3.12, P3.13, P3.14, P3.15
Checkpoint ID: M3.5-03
Use Case ID: UC-08
Category: Positive
Priority: High
Test Scenario: Failed delivery retries and is logged
Preconditions: UAT environment deployed via CI/CD. A report schedule exists. Mailer can be forced to fail (invalid SMTP / unreachable host) or no Approved/distributable report exists for the schedule.
Test Steps: 1. Configure a schedule that will fail delivery (bad SMTP or no Approved report for project+type).
2. Wait for cron/Bull job (or trigger the queue job in UAT).
3. Confirm schedule lastError is populated in UI/API and retries occur (Bull attempts).
4. Confirm audit_logs contains a delivery-failure event (e.g. REPORT_DELIVERY_FAILED).
5. Capture lastError UI/API + audit log extract.
Expected Result: Failed scheduled deliveries are retried by the queue and logged (schedule lastError + audit trail). Operators can see the failure reason.
Evidence to Capture: Schedule lastError screenshot/API + audit log extract for failed delivery.

================================================================================
Test Case ID: TC-M3.6-01
Phase: 3 - Reporting
Milestone ID: M3.6
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.6-01
Use Case ID: UC-10
Category: Positive
Priority: High
Test Scenario: Missing or unapproved timesheets flagged
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PMO Lead'/'PM' with data-quality access. Projects have allocations with missing and/or Submitted (unapproved) timesheets.
Test Steps: 1. Open Reports -> Data Quality (/dashboard/reports/data-quality).
2. In Scan rules, set Missing timesheet and Unapproved timesheet to Include (segmented Include/Exclude). Save rules.
3. Click Scan all projects.
4. Use filters (project / flag type / Open). confirm flags for missing and unapproved timesheets (if available).
5. Resolve a flag and confirm it leaves the Open list (or shows as Resolved when filtered).
6. Capture scan results table.
Expected Result: MISSING_TIMESHEET and UNAPPROVED_TIMESHEET flags are created by scan when rules Include those types. Filters/pagination work; Resolve updates flag status.
Evidence to Capture: Screenshots of Scan rules (Include/Exclude), scan results, and a resolved flag.

================================================================================
Test Case ID: TC-M3.6-02
Phase: 3 - Reporting
Milestone ID: M3.6
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.6-02
Use Case ID: UC-10
Category: Positive
Priority: High
Test Scenario: Stale integrations flagged
Preconditions: UAT environment deployed via CI/CD. Keka last success is older than the stale threshold (or no success). Tester can run Data Quality scan.
Test Steps: 1. On Data Quality -> Scan rules, set Stale integration to Include and Save rules.
2. Run Scan all projects.
3. Confirm a STALE_INTEGRATION flag is created with a clear description (if available).
Expected Result: Stale Keka/integration conditions produce STALE_INTEGRATION data-quality flags when the rule is Included.
Evidence to Capture: DQ flag screenshot + Keka last-success / sync evidence.

================================================================================
Test Case ID: TC-M3.6-03
Phase: 3 - Reporting
Milestone ID: M3.6
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.6-03
Use Case ID: UC-10
Category: Positive
Priority: High
Test Scenario: Incomplete project updates flagged
Preconditions: UAT environment deployed via CI/CD. An Active project is incomplete per scanner rules (e.g. missing required setup/milestones). Tester can run Data Quality scan.
Test Steps: 1. On Data Quality -> Scan rules, set Incomplete project to Include and Save rules.
2. Run Scan all projects.
3. Confirm INCOMPLETE_PROJECT flags appear for the incomplete projects (if available).
4. Capture flag rows + project evidence.
Expected Result: Incomplete projects are flagged as INCOMPLETE_PROJECT when that scan rule is Included.
Evidence to Capture: DQ incomplete-project flag screenshots + project setup evidence.

================================================================================
Test Case ID: TC-M3.6-04
Phase: 3 - Reporting
Milestone ID: M3.6
Current Milestone ID: P3.01, P3.02, P3.03, P3.04, P3.05, P3.06, P3.07
Checkpoint ID: M3.6-04
Use Case ID: UC-10
Category: Positive
Priority: High
Test Scenario: Include/exclude per approved rules
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated with permission to update data-quality rules.
Test Steps: 1. Open Data Quality -> Scan rules (list of checks with Include / Exclude segmented controls).
2. Set one type to Exclude (e.g. Stale integration) and keep others Include; click Save rules.
3. Run Scan all projects - confirm excluded types are not created/updated; included types still appear.
4. Set the excluded type back to Include, Save, and rescan - confirm it can appear again (if available).
5. Capture rules UI + scan results before/after.
Expected Result: Scan rules use Include/Exclude per flag type and persist on Save. Excluded types are skipped on scan; Include runs the check. Helper text clarifies Include runs the check and Exclude skips it.
Evidence to Capture: Screenshots of Scan rules Include/Exclude + scan results before/after exclude.

================================================================================
Test Case ID: TC-M3.1-06
Phase: 3 - Reporting
Milestone ID: M3.1
Current Milestone ID: P3.01
Checkpoint ID: M3.1-06
Use Case ID: UC-03
Category: Negative
Priority: Medium
Test Scenario: Report query with non-existent project ID
Preconditions: UAT environment deployed via CI/CD. Tester is authenticated as 'PMO Lead' with a valid JWT that has reports.view.
Test Steps: 1. Authenticate with a valid JWT that has reports.view.
2. Call GET /api/v1/reports/health/projects/{non-existent-uuid}.
3. Confirm HTTP 404 with a structured error (project not found).
4. Call GET /api/v1/reports/status/{non-existent-uuid} and confirm 404.
5. Capture API JSON responses.
Expected Result: Server returns a structured 404 error response for unknown project/report IDs. No partial writes occur.
Evidence to Capture: API JSON responses showing 404 error status.

TOTAL PHASE 3 CASES: 28
