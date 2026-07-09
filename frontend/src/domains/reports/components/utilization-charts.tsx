"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type {
  UtilisationDepartmentBreakdown,
  UtilisationEmployeeRow,
  UtilisationSummary,
} from "../types/reports.types";

const hoursChartConfig = {
  billable: { label: "Billable", color: "var(--chart-1)" },
  nonBillable: { label: "Non-billable", color: "var(--chart-3)" },
  submitted: { label: "Submitted", color: "var(--chart-4)" },
  planned: { label: "Planned", color: "var(--chart-5)" },
} satisfies ChartConfig;

const utilChartConfig = {
  utilisation: { label: "Billable util.", color: "var(--chart-1)" },
} satisfies ChartConfig;

const deptChartConfig = {
  billable: { label: "Billable", color: "var(--chart-1)" },
  nonBillable: { label: "Non-billable", color: "var(--chart-3)" },
} satisfies ChartConfig;

const STATUS_COLORS = {
  over: "var(--chart-5)",
  optimal: "var(--chart-2)",
  under: "var(--chart-4)",
} as const;

function truncateLabel(value: string, max = 14) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function UtilizationSummaryChart({
  summary,
}: {
  summary: UtilisationSummary | undefined;
}) {
  if (!summary) return null;

  const chartData = [
    {
      label: "Hours",
      billable: summary.totalBillableHours,
      nonBillable: summary.totalNonBillableHours,
      submitted: Math.max(0, summary.totalSubmittedHours - summary.totalApprovedHours),
      planned: Math.max(0, summary.totalPlannedHours - summary.totalSubmittedHours),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Hours breakdown</CardTitle>
        <CardDescription>Approved billable vs non-billable across the team</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={hoursChartConfig} className="min-h-[220px] w-full">
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="billable" stackId="a" fill="var(--color-billable)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="nonBillable" stackId="a" fill="var(--color-nonBillable)" />
            <Bar dataKey="submitted" stackId="b" fill="var(--color-submitted)" />
            <Bar dataKey="planned" stackId="c" fill="var(--color-planned)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function UtilizationByDepartmentChart({
  departments,
}: {
  departments: UtilisationDepartmentBreakdown[];
}) {
  if (departments.length === 0) return null;

  const chartData = departments.map((dept) => ({
    department: truncateLabel(dept.departmentName, 18),
    billable: dept.billableHours,
    nonBillable: dept.nonBillableHours,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">By department</CardTitle>
        <CardDescription>Approved billable and non-billable hours</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={deptChartConfig} className="min-h-[260px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="department"
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="billable" stackId="a" fill="var(--color-billable)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="nonBillable" stackId="a" fill="var(--color-nonBillable)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function UtilizationByEmployeeChart({
  rows,
}: {
  rows: UtilisationEmployeeRow[];
}) {
  if (rows.length === 0) return null;

  const chartData = [...rows]
    .sort((a, b) => b.billableUtilisationPercent - a.billableUtilisationPercent)
    .slice(0, 10)
    .map((row) => ({
      name: truncateLabel(row.name, 12),
      utilisation: row.billableUtilisationPercent,
      status: row.status,
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Billable utilisation</CardTitle>
        <CardDescription>Top employees by billable util % in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={utilChartConfig} className="min-h-[260px] w-full">
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="utilisation" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.status]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function UtilizationStatusPieChart({
  rows,
}: {
  rows: UtilisationEmployeeRow[];
}) {
  if (rows.length === 0) return null;

  const counts = rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { over: 0, optimal: 0, under: 0 },
  );

  const chartData = [
    { status: "over", value: counts.over, fill: STATUS_COLORS.over },
    { status: "optimal", value: counts.optimal, fill: STATUS_COLORS.optimal },
    { status: "under", value: counts.under, fill: STATUS_COLORS.under },
  ].filter((item) => item.value > 0);

  const pieConfig = {
    over: { label: "Overloaded", color: STATUS_COLORS.over },
    optimal: { label: "Optimal", color: STATUS_COLORS.optimal },
    under: { label: "Under", color: STATUS_COLORS.under },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Capacity mix</CardTitle>
        <CardDescription>Employee count by utilisation band</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={pieConfig} className="mx-auto min-h-[220px] max-w-[280px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="status"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="status" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
