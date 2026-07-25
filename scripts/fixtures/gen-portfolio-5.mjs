/**
 * Builds scripts/fixtures/uat-sample-portfolio-5.xml — one MSPDI with 5 L1 projects.
 * Run: node scripts/fixtures/gen-portfolio-5.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const PROJECTS = [
  "UAT Sample 01 — CyberSec Engagement",
  "UAT Sample 02 — Cloud Migration",
  "UAT Sample 03 — SOC Buildout",
  "UAT Sample 04 — Zero Trust Rollout",
  "UAT Sample 05 — IR Readiness",
];

function taskXml({
  uid,
  id,
  name,
  outlineLevel,
  outlineNumber,
  wbs,
  summary,
  start,
  finish,
  duration,
  milestone = false,
  predecessors = [],
}) {
  const predXml = predecessors
    .map(
      (p) => `      <PredecessorLink>
        <PredecessorUID>${p}</PredecessorUID>
        <Type>1</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>0</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`,
    )
    .join("\n");

  return `    <Task>
      <UID>${uid}</UID>
      <ID>${id}</ID>
      <Name>${name}</Name>
      <Type>${summary ? 1 : 0}</Type>
      <IsNull>0</IsNull>
      <OutlineLevel>${outlineLevel}</OutlineLevel>
      <OutlineNumber>${outlineNumber}</OutlineNumber>
      <WBS>${wbs}</WBS>
      <Summary>${summary ? 1 : 0}</Summary>
      <Critical>${summary ? 0 : 1}</Critical>
      <Priority>500</Priority>
      <Start>${start}</Start>
      <Finish>${finish}</Finish>
      <Duration>${duration}</Duration>
      <Manual>0</Manual>
      <PercentComplete>0</PercentComplete>
      <Milestone>${milestone ? 1 : 0}</Milestone>
${predXml}
    </Task>`;
}

const schedule = [
  {
    name: "Phase 1 — Discovery",
    summary: true,
    start: "2026-07-06T08:00:00",
    finish: "2026-07-17T17:00:00",
    duration: "PT80H0M0S",
    children: [
      {
        name: "Kickoff",
        start: "2026-07-06T08:00:00",
        finish: "2026-07-07T17:00:00",
        duration: "PT16H0M0S",
      },
      {
        name: "Requirements Workshop",
        start: "2026-07-08T08:00:00",
        finish: "2026-07-17T17:00:00",
        duration: "PT64H0M0S",
        predOffset: -1,
      },
    ],
  },
  {
    name: "Phase 2 — Design",
    summary: true,
    start: "2026-07-20T08:00:00",
    finish: "2026-08-07T17:00:00",
    duration: "PT112H0M0S",
    children: [
      {
        name: "Architecture Design",
        start: "2026-07-20T08:00:00",
        finish: "2026-07-31T17:00:00",
        duration: "PT80H0M0S",
        predOffset: -1,
      },
      {
        name: "Security Review",
        start: "2026-08-03T08:00:00",
        finish: "2026-08-07T17:00:00",
        duration: "PT40H0M0S",
        predOffset: -1,
      },
    ],
  },
  {
    name: "Phase 3 — Delivery",
    summary: true,
    start: "2026-08-10T08:00:00",
    finish: "2026-09-18T17:00:00",
    duration: "PT240H0M0S",
    children: [
      {
        name: "Implementation",
        start: "2026-08-10T08:00:00",
        finish: "2026-09-04T17:00:00",
        duration: "PT160H0M0S",
        predOffset: -1,
      },
      {
        name: "UAT",
        start: "2026-09-07T08:00:00",
        finish: "2026-09-15T17:00:00",
        duration: "PT56H0M0S",
        predOffset: -1,
      },
      {
        name: "Project Sign-OFF",
        start: "2026-09-18T08:00:00",
        finish: "2026-09-18T17:00:00",
        duration: "PT8H0M0S",
        milestone: true,
        predOffset: -1,
      },
    ],
  },
];

let uid = 1;
let id = 1;
const tasks = [];
const leafUids = [];

tasks.push(
  taskXml({
    uid: 0,
    id: 0,
    name: "UAT Sample Portfolio",
    outlineLevel: 0,
    outlineNumber: "0",
    wbs: "0",
    summary: true,
    start: "2026-07-06T08:00:00",
    finish: "2026-09-18T17:00:00",
    duration: "PT424H0M0S",
  }),
);

for (let p = 0; p < PROJECTS.length; p++) {
  const projIndex = p + 1;
  const projectUid = uid++;
  const projectId = id++;
  tasks.push(
    taskXml({
      uid: projectUid,
      id: projectId,
      name: PROJECTS[p],
      outlineLevel: 1,
      outlineNumber: String(projIndex),
      wbs: String(projIndex),
      summary: true,
      start: "2026-07-06T08:00:00",
      finish: "2026-09-18T17:00:00",
      duration: "PT424H0M0S",
    }),
  );

  let lastLeafUid = null;
  for (let ph = 0; ph < schedule.length; ph++) {
    const phase = schedule[ph];
    const phaseIndex = ph + 1;
    const phaseUid = uid++;
    const phaseId = id++;
    tasks.push(
      taskXml({
        uid: phaseUid,
        id: phaseId,
        name: phase.name,
        outlineLevel: 2,
        outlineNumber: `${projIndex}.${phaseIndex}`,
        wbs: `${projIndex}.${phaseIndex}`,
        summary: true,
        start: phase.start,
        finish: phase.finish,
        duration: phase.duration,
      }),
    );

    for (let t = 0; t < phase.children.length; t++) {
      const child = phase.children[t];
      const taskIndex = t + 1;
      const taskUid = uid++;
      const taskId = id++;
      const preds = [];
      if (child.predOffset != null && lastLeafUid != null) {
        preds.push(lastLeafUid);
      }
      tasks.push(
        taskXml({
          uid: taskUid,
          id: taskId,
          name: child.name,
          outlineLevel: 3,
          outlineNumber: `${projIndex}.${phaseIndex}.${taskIndex}`,
          wbs: `${projIndex}.${phaseIndex}.${taskIndex}`,
          summary: false,
          start: child.start,
          finish: child.finish,
          duration: child.duration,
          milestone: Boolean(child.milestone),
          predecessors: preds,
        }),
      );
      lastLeafUid = taskUid;
      leafUids.push(taskUid);
    }
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!--
  Cybsec PMO UAT fixture — MSPDI portfolio (5 projects in one file).
  Import via Projects → Import MPP.

  Shape (matches portfolio export):
  L1 = project summaries
  L2 = phases
  L3 = tasks

  Re-import the same file to verify no duplicate projects (name match → update).
-->
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>UAT Sample Portfolio</Name>
  <Title>UAT Sample Portfolio</Title>
  <Company>CyberSec IT</Company>
  <Author>Cybsec PMO Fixture</Author>
  <CreationDate>2026-07-01T09:00:00</CreationDate>
  <LastSaved>2026-07-01T09:00:00</LastSaved>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>2026-07-06T08:00:00</StartDate>
  <FinishDate>2026-09-18T17:00:00</FinishDate>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <CurrencyCode>USD</CurrencyCode>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
      <WeekDays>
        <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
        <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
${tasks.join("\n")}
  </Tasks>
</Project>
`;

const out = path.join(dir, "uat-sample-portfolio-5.xml");
fs.writeFileSync(out, xml);
console.log("wrote", out, "tasks=", tasks.length, "projects=", PROJECTS.length);

// Refresh single-project fixture header
const singlePath = path.join(dir, "uat-sample-schedule.xml");
let single = fs.readFileSync(singlePath, "utf8");
single = single.replace(
  /<!--[\s\S]*?-->/,
  `<!--
  Cybsec PMO UAT fixture — MSPDI (Project XML), single project.
  For multi-project import use uat-sample-portfolio-5.xml (5 projects in one file).
  Re-import this file into the same project to verify task upsert (DEF-P1-030).
  Import via Projects → Import MPP (accepts .xml).

  Structure:
  1. Phase 1 — Discovery (summary)
  2. Phase 2 — Design (summary)
  3. Phase 3 — Delivery (summary)
-->`,
);
fs.writeFileSync(singlePath, single);
console.log("updated", singlePath);
