const { PrismaClient } = require("../backend/node_modules/@prisma/client");

const p = new PrismaClient();

(async () => {
  const projects = await p.project.findMany({
    where: {
      OR: [
        { id: "1bee1810-9118-46c5-8441-eae69cd5d3d9" },
        { name: { contains: "DLP", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, endDate: true },
    take: 5,
  });
  console.log("projects", JSON.stringify(projects, null, 2));
  if (!projects.length) {
    const any = await p.project.findMany({
      select: { id: true, name: true },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });
    console.log("recent projects", any);
    await p.$disconnect();
    return;
  }

  const pid = projects[0].id;
  const byStatus = await p.task.groupBy({
    by: ["status"],
    where: { projectId: pid },
    _count: true,
  });
  console.log("\nALL rows by status:");
  console.table(byStatus.map((g) => ({ status: g.status, count: g._count })));

  const top = await p.task.groupBy({
    by: ["status"],
    where: { projectId: pid, parentTaskId: null },
    _count: true,
  });
  console.log("\nTOP-LEVEL by status:");
  console.table(top.map((g) => ({ status: g.status, count: g._count })));

  const total = await p.task.count({ where: { projectId: pid } });
  const nested = await p.task.count({
    where: { projectId: pid, parentTaskId: { not: null } },
  });
  console.log({ total, nested, topLevel: total - nested });

  const doneAll = await p.task.findMany({
    where: { projectId: pid, status: "Done" },
    select: { title: true, parentTaskId: true },
    orderBy: { title: "asc" },
  });
  console.log("\nDone tasks:", doneAll.length);
  for (const t of doneAll) {
    console.log(
      `  ${t.parentTaskId ? "NESTED" : "TOP   "} | ${t.title.slice(0, 60)}`,
    );
  }

  const todoAll = await p.task.count({
    where: { projectId: pid, status: "To_Do" },
  });
  const todoTop = await p.task.count({
    where: { projectId: pid, status: "To_Do", parentTaskId: null },
  });
  console.log("\nTo_Do all vs top-level:", { todoAll, todoTop });

  let sched = 0;
  try {
    sched = await p.task.count({
      where: { projectId: pid, scheduleMilestone: { isNot: null } },
    });
  } catch {
    sched = -1;
  }
  console.log("schedule milestone tasks:", sched);

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
