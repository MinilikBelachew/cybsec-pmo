/**
 * Update Phase 4 Risk & Compliance Test Steps + Expected Result
 * to match Phase 2/3 UAT format (concrete UI paths, numbered steps,
 * outcome-focused expected results — not the generic template).
 */
const path = require("path");
const ExcelJS = require(path.join(
  __dirname,
  "../backend/node_modules/exceljs",
));

const FILE = path.join(
  __dirname,
  "../UAT_Test_Case_Register_v2_phase_3 (3).xlsx",
);

/** @type {Record<string, { steps: string; expected: string }>} */
const UPDATES = {
  "TC-M4.1-01": {
    steps: `1. Log in to the PMO Platform as a PM or PMO Lead with risks:edit via EntraID SSO.
2. Navigate to Risk & Issues -> Risk Register (/dashboard/risks).
3. Click Add risk. Select a project and enter Title, Category (e.g. TECHNICAL), Impact (1-4), Likelihood (1-4), Owner, Mitigation plan, Target date, optional Residual impact/likelihood, and Status (Open).
4. Save. Confirm the risk appears in the register with Score = Impact x Likelihood, Mitigation plan populated, and residual rating when residual values were provided.
5. Apply Project / Category / Status filters and confirm the list narrows. Open the project workspace -> Risks tab and confirm the same risk is listed.`,
    expected: `Risk is created with category, impact, likelihood, auto-calculated score (impact x likelihood), owner, mitigation plan, target date, residual rating (when residual values are set), and status. The row appears on Risk Register and on the project workspace Risks tab. Project / Category / Status filters narrow the list. Create returns HTTP 201/200 with no validation errors.`,
  },
  "TC-M4.1-02": {
    steps: `1. Log in as a PM or PMO Lead with risks:edit via EntraID SSO.
2. Navigate to Risk & Issues -> Risk Register (/dashboard/risks) and click Add risk.
3. Attempt to save with Title blank, Owner unset, Project unset, or Impact/Likelihood outside 1-4.
4. Confirm client-side validation messages block submit and no incomplete risk appears in the list.
5. Optionally call POST /v1/projects/{projectId}/risks with missing required fields and confirm HTTP 400.`,
    expected: `Required fields (project, title, category, impact, likelihood, owner) are enforced. Invalid or incomplete submissions are rejected with clear validation messages in the form and/or HTTP 400 from the API. No incomplete risk row is persisted.`,
  },
  "TC-M4.1-03": {
    steps: `1. Log in as an Engineer who owns at least one risk. Open Risk & Issues -> Risk Register (/dashboard/risks).
2. Confirm Add risk / full Edit / Delete are hidden. Confirm only risks owned by the Engineer are listed (other owners' risks are absent).
3. Change Status on an owned risk (status-only). Confirm the status updates and non-status fields are not editable for Engineer.
4. Attempt POST /v1/projects/{projectId}/risks or a full-field PATCH as Engineer and confirm HTTP 403 (or non-status fields are rejected).
5. Log in as PM or PMO Lead with risks:edit and confirm create, full edit and delete are available within project record scope.`,
    expected: `Permissions and record scope are enforced. Engineer sees only owned risks, can update status only, and cannot create/full-edit/delete (UI gated; unauthorised writes return 403). PM / PMO Lead with risks:edit can manage risks within their project scope. No unauthorised write occurs.`,
  },
  "TC-M4.1-04": {
    steps: `1. Log in as a PM or PMO Lead via EntraID SSO and open Risk & Issues -> Risk Register (/dashboard/risks).
2. Click Add risk. Set Impact=3 and Likelihood=4; leave residual blank; save.
3. Confirm Score displays as 12 on the new row (read-only calculated score where shown).
4. Edit the risk to Impact=2, Likelihood=2; save and confirm Score updates to 4.
5. Set Residual impact=1 and Residual likelihood=2; save and confirm residual rating = 2.`,
    expected: `Score is auto-calculated as Impact x Likelihood (integer 1-4 matrix) on create and update and is not manually editable as an independent value. Residual rating is Residual impact x Residual likelihood when residual values are provided. UI and API score fields match the formula after refresh.`,
  },
  "TC-M4.1-05": {
    steps: `1. Log in as PMO Lead with notifications:manage. Open Risk & Issues -> Alert Catalogue (/dashboard/alerts) and ensure an Active rule exists for Event type Risk score breached (RISK_SCORE_BREACHED) with Score threshold (>=)=12 and at least one Recipient role.
2. As PM/PMO Lead, create or update a risk so Score >= 12 (e.g. Impact=4, Likelihood=3).
3. Confirm a notification is delivered to scoped recipient users and an Alert instance appears under Recent alert instances with the risk title in the Object column.
4. Open Dashboard (/dashboard) as PMO Lead and confirm Active risks / risk KPI reflects open Risk register rows (status not Closed/Cancelled) for scoped projects.`,
    expected: `When score reaches or crosses the configured catalogue threshold (default scoreGte 12), the alert engine fires for RISK_SCORE_BREACHED and scoped recipients receive notification. An Alert instance lists the risk title in the Object column. Dashboard active-risk KPI counts open Risk table rows for scoped projects. Inactive rules do not fire new events.`,
  },
  "TC-M4.1-06": {
    steps: `1. Log in to the PMO Platform as a PM with risks:edit via EntraID SSO.
2. Navigate to Risk & Issues -> Risk Register (/dashboard/risks) and click Add risk.
3. Attempt to enter non-integer or out-of-range Impact/Likelihood values (e.g. Impact=0, Likelihood=5, or decimal values if the control allows free text).
4. Confirm the form blocks save and requires integer values between 1 and 4 inclusive.
5. Enter valid Impact=2 and Likelihood=3, save, and confirm Score = 6.`,
    expected: `Invalid impact/likelihood values outside the 1-4 integer matrix are rejected by form validation (and/or HTTP 400). No risk is saved with an invalid score matrix. Valid values calculate Score = Impact x Likelihood correctly.`,
  },
  "TC-M4.2-01": {
    steps: `1. Log in as a PM, PMO Lead or Team Lead with issues:edit via EntraID SSO.
2. Navigate to Risk & Issues -> Issue Tracker (/dashboard/issues).
3. Click Raise / Add issue. Select project, Title, Priority (Low/Medium/High/Critical), Owner, Due date (required), optional Expected resolution date, and Status Open.
4. Save. Confirm the issue appears with priority, owner, due date and status badge.
5. Open the issue Details sheet, then Resolve/Close: enter Resolution note (required) and upload one or more evidence files; confirm.
6. Confirm Status is Resolved/Closed, evidence opens via secure file links in Details, and the issue appears on the project workspace -> Issues tab.`,
    expected: `Issue is created with priority, owner, due date, status and optional expected resolution date. Resolve/Close requires a resolution note and supports multi-file evidence; evidence is viewable via secure links in Details. Status shows as a badge on the tracker. The issue appears on Issue Tracker and the project workspace Issues tab. APIs return success without validation errors.`,
  },
  "TC-M4.2-02": {
    steps: `1. Log in as PM/PMO Lead/Team Lead via EntraID SSO and open Risk & Issues -> Issue Tracker (/dashboard/issues).
2. Click Add issue. Set Expected resolution date to a future date and save.
3. Open Details (or the form) and confirm Expected resolution date is shown.
4. Edit the date and confirm it updates; clear it if the UI allows and confirm null is accepted.`,
    expected: `Expected resolution date is captured on create/update, displayed on the issue detail/form, and persisted via the issues API. Changing or clearing the date updates the stored value accordingly.`,
  },
  "TC-M4.2-03": {
    steps: `1. Log in as PMO Lead with notifications:manage. Ensure an Active Alert Catalogue rule exists for Event type Issue escalated (ISSUE_ESCALATED) with Recipient roles set (Score threshold is not required for this event type).
2. Create an issue with Priority=High or Critical, or with Due date in the past and Status Open.
3. Confirm the Issue Tracker shows Escalation and/or Overdue indicators and ISSUE_ESCALATED notification is sent to scoped recipients.
4. Open Alert Catalogue -> Recent alert instances and confirm an ISSUE_ESCALATED instance lists the issue title in the Object column.`,
    expected: `Overdue and/or High/Critical open issues show escalation/overdue indicators in the UI and trigger ISSUE_ESCALATED notification plus a matching Alert instance when an Active catalogue rule exists. Score threshold is not required for ISSUE_ESCALATED. Object column shows the issue title. Recipients are limited by role and project record scope.`,
  },
  "TC-M4.2-04": {
    steps: `1. Log in as PM/PMO Lead/Team Lead via EntraID SSO and open an Open issue on Risk & Issues -> Issue Tracker (/dashboard/issues).
2. Resolve/Close the issue with a resolution note (and optional evidence files).
3. Confirm raiser and owner receive ISSUE closed / closure notification.
4. Confirm Status=Closed/Resolved and closed/updated timestamps are set; Details still shows resolution and evidence.`,
    expected: `Closing or resolving an issue notifies relevant parties (raiser/owner). Status becomes Closed/Resolved with resolution note (and evidence when provided) retained in Details. Closure notification is visible in Notifications.`,
  },
  "TC-M4.3-01": {
    steps: `1. Log in as PMO Lead / admin with notifications:manage via EntraID SSO.
2. Navigate to Risk & Issues -> Alert Catalogue (/dashboard/alerts).
3. Click Add rule. Set Event type=Risk score breached (RISK_SCORE_BREACHED). Confirm Score threshold (>=) is visible and required; set it to 12.
4. Complete required Channels, Recipient roles (at least one), Escalation role, Reminder cadence and Escalation delay; Save.
5. Confirm the rule appears in Catalogue rules with the threshold shown. Create a risk with score below threshold and confirm no new Alert instance; then raise score >= 12 and confirm an instance fires.
6. Confirm Event type options are limited to RISK_SCORE_BREACHED and ISSUE_ESCALATED.`,
    expected: `Alert thresholds are configurable per RISK_SCORE_BREACHED rule (thresholdConfig.scoreGte) and are required for that event type. Catalogue event types are limited to RISK_SCORE_BREACHED and ISSUE_ESCALATED. Rules persist on Alert Catalogue; events fire only when the metric meets the configured threshold and the rule is Active.`,
  },
  "TC-M4.3-02": {
    steps: `1. Log in as PMO Lead with notifications:manage via EntraID SSO and open Risk & Issues -> Alert Catalogue (/dashboard/alerts).
2. Click Add rule. Under Channels, select In-app and/or Email via the checkboxes (at least one required) and complete other required fields; Save.
3. Confirm the Channels column shows the selected values (e.g. in_app, email).
4. Trigger a matching alert (e.g. high risk score) and confirm Alert instance rows are created per channel with delivery status Queued/Sent.`,
    expected: `Channels are configurable on each rule via In-app and Email checkboxes (at least one required). Saved channels display on the catalogue table. Fired alerts create per-channel Alert instances with delivery status tracked.`,
  },
  "TC-M4.3-03": {
    steps: `1. Log in as PMO Lead with notifications:manage via EntraID SSO and open Alert Catalogue -> Add rule.
2. Under Recipient roles, leave none selected and confirm validation blocks save.
3. Select one or more roles and Save. Confirm the Recipients column lists the selected role labels.
4. Fire a matching alert on a project. Confirm only active users with those roles who can access that project per record scope receive the notification.`,
    expected: `Recipient roles are required on create and shown on the catalogue. When an alert fires, notifications go only to active users in the selected roles who pass project record-scope checks. Submitting with no recipient roles is rejected by validation (UI and API).`,
  },
  "TC-M4.3-04": {
    steps: `1. Log in as PMO Lead with notifications:manage via EntraID SSO and open Alert Catalogue -> Add rule.
2. Set Reminder cadence (hrs) to a low test value (e.g. 1) and complete other required fields; Save.
3. Fire an alert and leave it unacknowledged.
4. Wait for / trigger the alert reminder job (ALERT_REMINDER_CRON) and confirm a reminder notification is sent (including risk/issue title and project context) and nextReminderAt advances.`,
    expected: `Reminder cadence (hours) is stored on the rule. Unacknowledged Alert instances receive reminder notifications on the configured cadence via the alert reminder scheduler. Reminder content includes the risk/issue title and project context; nextReminderAt updates after each reminder.`,
  },
  "TC-M4.3-05": {
    steps: `1. Log in as PM, PMO Lead, Team Lead, Super Admin or IT Admin with notifications:view via EntraID SSO. Open Risk & Issues -> Alert Catalogue (/dashboard/alerts) and locate Recent alert instances.
2. Confirm Engineer (or other roles outside that set) cannot see the instances table / Acknowledge (sidebar and API gated).
3. Identify an unacknowledged instance (Status not Acknowledged). Click Acknowledge.
4. Confirm Status shows a single Acknowledged badge, ackedAt/acknowledgedBy are set, and further reminders/escalation stop for that event.`,
    expected: `Acknowledgement is supported on alert instances for pm, pmo_lead, team_lead, super_admin and it_admin only. After ack, Status shows a single Acknowledged badge, acknowledgement metadata is set, and reminder/escalation progression for that event stops. Unauthorised roles cannot list or acknowledge instances (UI gated / HTTP 403).`,
  },
  "TC-M4.3-06": {
    steps: `1. Log in as PMO Lead with notifications:manage via EntraID SSO and open Alert Catalogue -> Add rule.
2. Open Escalation role and confirm the dropdown only lists PM, PMO Lead, Team Lead, Super Admin and IT Admin (not Engineer/Client/etc.).
3. Set Escalation role (e.g. pmo_lead) and Escalation delay (hrs) to a low test value; Save. Confirm Escalation column shows role / delay.
4. Fire an alert, leave it unacked past the delay (or adjust timestamps / run the escalation path), and confirm escalation notification reaches scoped users of the escalation role and escalationLevel increments.`,
    expected: `Escalation is defined per rule via escalationRole (restricted to pm, pmo_lead, team_lead, super_admin, it_admin) and escalationDelayHrs. Unacknowledged alerts past the delay notify scoped users of the escalation role and increment escalationLevel. Catalogue UI shows the configured role and delay.`,
  },
  "TC-M4.3-07": {
    steps: `1. Log in as PMO Lead with notifications:manage via EntraID SSO. Create/activate a catalogue rule and force a failed delivery (or mark an AlertEvent deliveryStatus=failed with nextReminderAt due).
2. Wait for / run the alert retry job (ALERT_RETRY_CRON).
3. Confirm retries follow backoff 1h -> 4h -> 12h (max 3 attempts) and status moves to Sent on success or Dead/Failed after exhaustion.
4. Confirm retry notifications include risk/issue title context where applicable.`,
    expected: `Retry behaviour is defined: failed deliveries retry with backoff 1h, 4h, 12h (max 3 attempts), then dead/failed. The retry scheduler processes due retries. Retry messages include object title context where the risk/issue can be resolved.`,
  },
  "TC-M4.3-08": {
    steps: `1. Log in as a manage-capable role via EntraID SSO and open Risk & Issues -> Alert Catalogue (/dashboard/alerts).
2. Confirm Catalogue rules list Event, Threshold, Channels, Recipients, Cadence, Escalation and Actions (Active/Inactive control + Delete).
3. Toggle a rule Inactive then Active and confirm state persists after refresh; confirm Inactive rules do not fire new instances.
4. Click Delete; confirm the warning dialog states the rule and its alert instances will be removed; Cancel leaves the rule; Confirm hard-deletes the rule and related instances.
5. Cross-check that live catalogue fields match the implemented catalogue (event types, threshold only for risk breach, required recipients, escalation role set, ack roles).`,
    expected: `Alert catalogue is operable end-to-end in the UI: thresholds/channels/recipients/cadence/escalation are visible; Active/Inactive toggle enables or disables firing; Delete uses a warning dialog and permanently removes the rule and its instances. Live fields align with the implemented catalogue (RISK_SCORE_BREACHED / ISSUE_ESCALATED only; recipients required; escalation and instance ack limited to the approved role set).`,
  },
  "TC-M4.4-01": {
    steps: `1. Log in as a PM or PMO Lead with issues:edit or risks:edit via EntraID SSO.
2. Navigate to Risk & Issues -> Escalations (/dashboard/escalations).
3. Create an escalation: select Project, Customer, Severity (Low/Medium/High/Critical), SLA target hours (>=1), Owner, optional initial communication and channel (Call/Email/Meeting/Chat/Other).
4. Save. Confirm the card/list shows customer, severity, SLA hours, owner, status Open, and communication if provided.
5. Close with a resolution summary and confirm closure fields update.`,
    expected: `Customer escalation captures customer, severity, SLA target hours, owner, optional initial communication/channel, resolution and closure. Create opens status Open; close stores resolution summary and closedAt. The record is visible on the Escalations list. Users without edit permission cannot create.`,
  },
  "TC-M4.4-02": {
    steps: `1. Log in as a PM or PMO Lead via EntraID SSO and open an existing Open escalation on Risk & Issues -> Escalations (/dashboard/escalations).
2. Expand Communication log and add a communication with Channel (e.g. Email) and content.
3. Confirm the communication appears in the history with logger and timestamp after save.`,
    expected: `Customer communications are recorded against the escalation with channel, content, logger and timestamp. History remains visible on the escalation after save.`,
  },
  "TC-M4.4-03": {
    steps: `1. Log in as a PM or PMO Lead via EntraID SSO and create an escalation with a short SLA (e.g. 1 hour) or High/Critical severity on /dashboard/escalations.
2. Confirm High/Critical notify management on create (ESCALATION_MANAGEMENT) where configured.
3. For SLA breach: leave Open past slaTargetHrs (or adjust createdAt) and wait for / run Escalation SLA job (ESCALATION_SLA_CRON).
4. Confirm the UI shows Overdue SLA / SLA breached (slaBreached=true) and management notification is sent.`,
    expected: `High/Critical escalations notify management on create where configured. Open escalations past SLA are marked slaBreached by the SLA scheduler, show Overdue/SLA breached in the UI, and escalate to management. Notifications are visible to management roles / owner.`,
  },
  "TC-M4.4-04": {
    steps: `1. Log in as a PM or PMO Lead via EntraID SSO and open an Open escalation on /dashboard/escalations.
2. Choose Close, enter Resolution summary (required), and confirm.
3. Confirm Status=Closed, closedAt set, and slaBreached reflects whether SLA was exceeded at close.
4. Confirm closure notification (ESCALATION_CLOSED) is received by the owner.`,
    expected: `Closure is tracked with status Closed, resolution summary, closedAt and slaBreached flag. Owner receives closure notification. Closed escalations no longer appear as open in filters.`,
  },
  "TC-M4.5-01": {
    steps: `1. Log in as PM/Team Lead (action-point manager role) via EntraID SSO and open a project workspace -> Action Points panel.
2. Click Add action point. Create one with Source=Project (default).
3. Create another with Source=Task and select a linked task; then Source=Risk and Source=Issue with required linked entities.
4. Confirm each row shows the Source badge (Project/Task/Risk/Issue).
5. Open Risk & Issues -> Action Points (/dashboard/actions) and confirm the linked actions appear in the portfolio list.`,
    expected: `Action points can link to Project, Task, Risk and Issue from the workspace Action Points UI (source picker + linked entity; Risk/Issue require sourceId). Source type is shown on each action row. Linked actions appear on the Action Points portfolio (/dashboard/actions). Meeting/MoM sources remain available via meeting flows/API where applicable.`,
  },
  "TC-M4.5-02": {
    steps: `1. Log in as PM/Team Lead via EntraID SSO and open a project workspace -> Action Points panel.
2. Click Add action point. Enter Name, Owner (from project assignees), Due date (within project start/end), Priority (Low/Medium/High/Critical), leave Status Open.
3. Save. Confirm the list shows owner, due date, priority and status.
4. As Engineer assignee, update status to In Progress then Done (optional closure note); confirm Cancelled is not offered. As manager, confirm Cancelled is available.`,
    expected: `Action points require/store owner, due date, priority and status. Due date is constrained to the project date range. Managers can set all statuses including Cancelled; Engineer assignees can update Open / In Progress / Done only (own APs). Values persist after refresh.`,
  },
  "TC-M4.5-03": {
    steps: `1. Log in as PM/Team Lead via EntraID SSO and create an open action point with Due date within the next 3 days.
2. Open Risk & Issues -> Action Points (/dashboard/actions) and click Send due reminders; confirm toast shows sent count.
3. Confirm ACTION_POINT_REMINDER notification reaches the owner.
4. Optionally wait for / run the scheduled reminder job (ACTION_POINT_REMINDER_CRON) and confirm reminders are also sent automatically.`,
    expected: `Reminders are sent for open action points due within 3 days via manual Send due reminders and/or the daily reminder scheduler. Owners receive ACTION_POINT_REMINDER notifications. Sent count is reported in the UI toast.`,
  },
  "TC-M4.5-04": {
    steps: `1. Log in as PM/Team Lead via EntraID SSO and create an open action point with Due date in the past (or adjust due_date for UAT).
2. Confirm the row shows Overdue in the Action Points panel / portfolio.
3. Wait for / run the overdue job (ACTION_POINT_OVERDUE_CRON), or create/update an already-overdue action to trigger notify-on-write.
4. Confirm ACTION_POINT_OVERDUE notification is sent to the owner.`,
    expected: `Overdue open action points are flagged in the UI. Overdue escalation/notification is sent to the owner via write-time notify and/or the dedicated overdue scheduler. Notification type ACTION_POINT_OVERDUE is recorded.`,
  },
  "TC-M4.5-05": {
    steps: `1. Log in as PM/PMO Lead via EntraID SSO and open Risk & Issues -> Action Points (/dashboard/actions).
2. Confirm closure report KPIs: Total, Closed, Overdue open (and filters by project / source where shown).
3. Confirm breakdowns by owner and by status (and source type if shown).
4. Close an action point (status Done with optional closure note) and refresh; confirm Closed count increases and the item leaves overdue-open if applicable.`,
    expected: `Closure reporting is available on the Action Points portfolio: totals for total/closed/overdue-open plus breakdowns by owner and status (and source when shown). Closing actions updates the report figures after refresh. Portfolio list remains read-oriented; create/edit remain on the project workspace panel.`,
  },
  "TC-M4.6-01": {
    steps: `1. Log in as a user with projects:edit (PM/PMO Lead) via EntraID SSO.
2. Navigate to Risk & Issues -> Lessons Learned (/dashboard/lessons).
3. Click Capture / Add lesson. Select Category (e.g. DEPLOYMENT), enter Description and Recommendation, optional Tags (comma-separated) and Project (or org-wide / none).
4. Save. Confirm the lesson appears in the list with category, description, recommendation, tags and author.`,
    expected: `Lessons are captured with category, description/context, recommendation, optional tags/project and author. The new lesson appears on Lessons Learned after save (HTTP 201/200).`,
  },
  "TC-M4.6-02": {
    steps: `1. Log in as a user with projects:view via EntraID SSO and open Risk & Issues -> Lessons Learned (/dashboard/lessons) with several lessons present (different categories/tags).
2. Filter by Category and confirm the list narrows.
3. Use search (q) for a word in description/recommendation and confirm matching lessons only.
4. Clear filters and confirm the full set is restored.`,
    expected: `Lessons are searchable/filterable by category and free-text query (description/recommendation/category). Filters narrow the list without errors; clearing filters restores the full set.`,
  },
  "TC-M4.6-03": {
    steps: `1. Ensure at least one lesson exists that matches a test project's department (or is org-wide with no project).
2. Log in as PM/PMO Lead via EntraID SSO and open Projects -> Create Project. Confirm Surfaced lessons panel (Lessons for project setup) loads relevant lessons (category, description, recommendation).
3. Edit an existing project and set Status to Pending Closure. Confirm Lessons for project closure surfaces related lessons where implemented.
4. Confirm GET /v1/lessons/surface returns the same set used by the UI (empty state when no matches).`,
    expected: `Relevant lessons are surfaced during project setup (Create Project sheet) and project closure (Pending Closure) from /lessons/surface by department (project department or org-wide). The surfaced panel lists category, description and recommendation. Empty state shows when no matches exist.`,
  },
  "TC-M4.6-04": {
    steps: `1. Log in as an Engineer without projects:edit (view-only as seeded) via EntraID SSO.
2. Open Risk & Issues -> Lessons Learned (/dashboard/lessons). Confirm Capture / Add lesson is hidden or create is denied (Engineer may also be excluded from the sidebar).
3. Attempt POST /v1/lessons with a valid body and confirm HTTP 403.
4. Log in as PM/PMO Lead with projects:edit and confirm create/update succeed.
5. Confirm lessons APIs are gated by projects:view (read) and projects:edit (write).`,
    expected: `Permission controls are enforced via projects:view/edit on lessons endpoints and UI. Unauthorised create/update returns 403 and does not persist. Authorised project editors can capture and update lessons. Engineer cannot create lessons.`,
  },
};

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.getWorksheet("Test Cases");
  if (!ws) throw new Error("Worksheet 'Test Cases' not found");

  let updated = 0;
  const missing = new Set(Object.keys(UPDATES));

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const phase = String(row.getCell(2).value || "");
    const id = String(row.getCell(1).value || "");
    if (!phase.startsWith("4 ")) continue;
    const payload = UPDATES[id];
    if (!payload) {
      console.warn(`No update mapped for ${id} at row ${r}`);
      continue;
    }
    row.getCell(11).value = payload.steps;
    row.getCell(12).value = payload.expected;
    row.commit();
    missing.delete(id);
    updated++;
    console.log(`Updated row ${r} ${id}`);
  }

  if (missing.size) {
    throw new Error(`Unused update keys: ${[...missing].join(", ")}`);
  }

  await wb.xlsx.writeFile(FILE);
  console.log(`Saved ${updated} Phase 4 cases to ${FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
