"use client";

import * as React from "react";
import { useState } from "react";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useRole } from "@/shared/providers/role-provider";
import { useAuth } from "@/domains/auth";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  type User,
} from "@/domains/users";
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  Mail,
  User as UserIcon,
  Globe,
  Settings,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const { userRole } = useRole();
  const isSuperAdmin = userRole === "super_admin";

  const [activeTab, setActiveTab] = useState<"profile" | "users">(isSuperAdmin ? "users" : "profile");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    displayName: "",
    email: "",
    roleCode: "engineer",
  });
  const [editForm, setEditForm] = useState({
    roleCode: "",
    isActive: true,
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // RTK Query hooks
  const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useGetUsersQuery(
    { page: 1, limit: 100 },
    { skip: !isSuperAdmin }
  );

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!addForm.displayName || !addForm.email) {
      setActionError("Display Name and Email are required.");
      return;
    }

    try {
      await createUser({
        displayName: addForm.displayName,
        email: addForm.email.toLowerCase().trim(),
        role: { code: addForm.roleCode },
        entraObjectId: "pending-first-login", // Will be linked when they sign in
        isActive: true,
        isExternal: addForm.roleCode === "client" || addForm.roleCode === "vendor",
      }).unwrap();

      setActionSuccess(`User ${addForm.displayName} registered successfully.`);
      setAddForm({ displayName: "", email: "", roleCode: "engineer" });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setActionError(err.data?.message || "Failed to create user. Email may already be in use.");
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      roleCode: user.roleCode || user.role?.code || "engineer",
      isActive: user.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await updateUser({
        id: selectedUser.id,
        body: {
          role: { code: editForm.roleCode },
          isActive: editForm.isActive,
          isExternal: editForm.roleCode === "client" || editForm.roleCode === "vendor",
        },
      }).unwrap();

      setActionSuccess(`User updated successfully.`);
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      setActionError(err.data?.message || "Failed to update user.");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.displayName}?`)) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await deleteUser(user.id).unwrap();
      setActionSuccess("User deleted successfully.");
    } catch (err: any) {
      setActionError(err.data?.message || "Failed to delete user.");
    }
  };

  const toggleUserActiveStatus = async (user: User) => {
    setActionError(null);
    setActionSuccess(null);

    try {
      await updateUser({
        id: user.id,
        body: {
          isActive: !user.isActive,
        },
      }).unwrap();
      setActionSuccess(`Status for ${user.displayName} updated.`);
    } catch (err: any) {
      setActionError(err.data?.message || "Failed to toggle status.");
    }
  };

  // Filtered users list
  const filteredUsers = usersData?.data?.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.roleCode.toLowerCase().includes(query)
    );
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "pmo_lead":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "project_manager":
      case "pm":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "team_lead":
        return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
      case "engineer":
      case "member":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "finance":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "hr":
        return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "pmo_lead":
        return "PMO Lead";
      case "project_manager":
      case "pm":
        return "Project Manager";
      case "team_lead":
        return "Team Lead";
      case "engineer":
        return "Engineer";
      case "finance":
        return "Finance";
      case "hr":
        return "HR";
      case "client":
        return "Client";
      case "vendor":
        return "Vendor";
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Settings & Administration"
          description="Configure your platform settings, directory access, and enterprise role assignments."
        />
        {activeTab === "users" && isSuperAdmin && (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-150"
          >
            <UserPlus className="size-4" />
            Add New User
          </Button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={cn(
            "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="size-4" />
          My Profile
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              activeTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-4" />
            User Directory
          </button>
        )}
      </div>

      {/* Success/Error Alerts */}
      {actionSuccess && (
        <div className="p-3 text-sm font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5">
          <CheckCircle className="size-4 shrink-0" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2.5">
          <XCircle className="size-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Tab Contents: Profile */}
      {activeTab === "profile" && (
        <Card className="rounded-2xl border bg-card">
          <CardHeader>
            <CardTitle>Enterprise User Profile</CardTitle>
            <CardDescription>
              Your enterprise profile details synced from Microsoft Entra ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 items-center border-b pb-6 border-border">
              <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <UserIcon className="size-8 text-primary" />
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-lg font-bold">{currentUser?.name || "No Name"}</h3>
                <p className="text-sm text-muted-foreground">{currentUser?.email || "No Email"}</p>
                <div className="flex gap-2 justify-center sm:justify-start pt-1">
                  {currentUser?.roles?.map((role) => (
                    <Badge key={role} className={cn("text-xs border px-2 py-0.5", getRoleBadgeColor(role))}>
                      {getRoleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Integration Partner</label>
                <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-muted/20">
                  <Globe className="size-4 text-primary" />
                  <span className="text-sm">Microsoft Azure (Entra ID)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Access Level</label>
                <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-muted/20">
                  <Shield className="size-4 text-primary" />
                  <span className="text-sm capitalize">{userRole.replace("_", " ")} Access</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Contents: Users Directory (Super Admin Only) */}
      {activeTab === "users" && isSuperAdmin && (
        <Card className="rounded-2xl border bg-card">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>User Directory</CardTitle>
              <CardDescription>
                Manage pre-registered users, assign security roles, and track Microsoft link statuses.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetchUsers()}
                className="rounded-xl border shrink-0 hover:bg-muted/50"
                title="Refresh user directory"
              >
                <RefreshCw className={cn("size-4", isLoadingUsers && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="size-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Fetching directory users...</p>
              </div>
            ) : filteredUsers && filteredUsers.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/80 text-muted-foreground">
                      <th className="p-3 font-semibold">User Details</th>
                      <th className="p-3 font-semibold">Security Role</th>
                      <th className="p-3 font-semibold text-center">Status</th>
                      <th className="p-3 font-semibold text-center">Identity Link</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredUsers.map((u) => {
                      const isLinked = u.entraObjectId && u.entraObjectId !== "pending-first-login";
                      return (
                        <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{u.displayName}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Mail className="size-3 text-muted-foreground/60" />
                              {u.email}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge className={cn("text-xs font-semibold px-2 py-0.5 border", getRoleBadgeColor(u.roleCode || u.role?.code || ""))}>
                              {getRoleLabel(u.roleCode || u.role?.code || "")}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleUserActiveStatus(u)}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border transition-all duration-150",
                                u.isActive
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/25"
                                  : "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/25"
                              )}
                              title={u.isActive ? "Deactivate User" : "Activate User"}
                            >
                              <span className={cn("size-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-red-500")} />
                              {u.isActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-medium px-2 py-0.5",
                                isLinked
                                  ? "bg-blue-500/5 text-blue-500 border-blue-500/20"
                                  : "bg-amber-500/5 text-amber-500 border-amber-500/20"
                              )}
                              title={isLinked ? `ID: ${u.entraObjectId}` : "Awaiting first SSO login"}
                            >
                              {isLinked ? "SSO Linked" : "SSO Pending"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditUser(u)}
                                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                title="Edit Role"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(u)}
                                className="size-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete User"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No users found matching your search.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-5 border-b flex justify-between items-center bg-muted/10">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                Register New User
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <XCircle className="size-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Display Name</label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Roba Belachew"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Microsoft Email (UPN)</label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. roba@bminilik12gmail.onmicrosoft.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                  Must match the user's principal name / sign-in email in Microsoft Entra.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">System Role</label>
                <select
                  value={addForm.roleCode}
                  onChange={(e) => setAddForm({ ...addForm, roleCode: e.target.value })}
                  className="flex h-10 w-full rounded-xl border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="pmo_lead">PMO Lead</option>
                  <option value="pm">Project Manager</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="engineer">Engineer</option>
                  <option value="finance">Finance</option>
                  <option value="hr">HR</option>
                  <option value="client">Client (External)</option>
                  <option value="vendor">Vendor (External)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {isCreating ? "Registering..." : "Register User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-5 border-b flex justify-between items-center bg-muted/10">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Edit2 className="size-4.5 text-primary" />
                Edit User: {selectedUser.displayName}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <XCircle className="size-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Email (Read Only)</label>
                <Input
                  type="text"
                  disabled
                  value={selectedUser.email}
                  className="rounded-xl bg-muted/40 cursor-not-allowed opacity-80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">System Role</label>
                <select
                  value={editForm.roleCode}
                  onChange={(e) => setEditForm({ ...editForm, roleCode: e.target.value })}
                  className="flex h-10 w-full rounded-xl border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="pmo_lead">PMO Lead</option>
                  <option value="pm">Project Manager</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="engineer">Engineer</option>
                  <option value="finance">Finance</option>
                  <option value="hr">HR</option>
                  <option value="client">Client (External)</option>
                  <option value="vendor">Vendor (External)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="size-4 text-primary rounded border-input focus:ring-primary"
                />
                <label htmlFor="edit-is-active" className="text-sm font-semibold select-none cursor-pointer">
                  Account is Active
                </label>
              </div>

              <div className="flex gap-2.5 pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
