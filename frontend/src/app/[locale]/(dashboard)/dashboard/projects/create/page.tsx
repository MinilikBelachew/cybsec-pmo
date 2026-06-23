"use client";

import Link from "next/link";
import { useRole } from "@/shared/providers/role-provider";
import { CreateProjectForm } from "@/domains/projects/components/create-project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { ShieldAlert } from "lucide-react";

const CREATE_PROJECT_ROLES = ["super_admin", "pmo_lead", "project_manager"];

export default function CreateProjectPage() {
  const { userRole } = useRole();
  const canCreate = CREATE_PROJECT_ROLES.includes(userRole);

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="size-6 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only Super Admin, PMO Lead, and PM roles can create projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CreateProjectForm />;
}
