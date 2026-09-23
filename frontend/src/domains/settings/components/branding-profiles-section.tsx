"use client";
import { Spinner } from "@/shared/components/spinner";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Palette, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { getApiErrorMessage } from "@/core/errors/api-error";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  useClearBrandingLogoMutation,
  useCreateBrandingProfileMutation,
  useDeleteBrandingProfileMutation,
  useGetBrandingProfilesQuery,
  useUpdateBrandingProfileMutation,
  useUploadBrandingLogoMutation,
} from "../api/branding.api";
import {
  DEFAULT_MUTED_COLOR,
  brandingProfileFormSchema,
  emptyBrandingProfileFormValues,
  type BrandingProfileFormValues,
} from "../schemas/branding-profile.schema";
import type { BrandingProfile } from "../types/branding.types";

type Props = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-900 outline-none dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white";

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-transparent p-1 dark:border-white/[0.08]"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className={inputClassName}
          maxLength={7}
        />
      </div>
      {error && (
        <p className="text-[11px] font-semibold text-rose-500">{error}</p>
      )}
    </div>
  );
}

export function BrandingProfilesSection({ onSuccess, onError }: Props) {
  const { data: profiles = [], isLoading } = useGetBrandingProfilesQuery();
  const [createProfile, { isLoading: creating }] =
    useCreateBrandingProfileMutation();
  const [updateProfile, { isLoading: updating }] =
    useUpdateBrandingProfileMutation();
  const [deleteProfile, { isLoading: deleting }] =
    useDeleteBrandingProfileMutation();
  const [uploadLogo, { isLoading: uploading }] =
    useUploadBrandingLogoMutation();
  const [clearLogo, { isLoading: clearing }] = useClearBrandingLogoMutation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [existingLogoName, setExistingLogoName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandingProfile | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BrandingProfileFormValues>({
    resolver: zodResolver(brandingProfileFormSchema),
    defaultValues: emptyBrandingProfileFormValues,
    mode: "onSubmit",
  });

  const logoFile = watch("logoFile");
  const removeLogo = watch("removeLogo");
  const busy = creating || updating || deleting || uploading || clearing;

  const openCreate = () => {
    setEditingId(null);
    setExistingLogoName(null);
    reset(emptyBrandingProfileFormValues);
    setShowForm(true);
  };

  const openEdit = (profile: BrandingProfile) => {
    setEditingId(profile.id);
    setExistingLogoName(profile.hasLogo ? profile.logoFileName : null);
    reset({
      name: profile.name,
      companyName: profile.companyName,
      documentOwner: profile.documentOwner,
      primaryColor: profile.primaryColor,
      accentColor: profile.accentColor,
      lineColor: profile.lineColor,
      isDefault: profile.isDefault,
      logoFile: null,
      removeLogo: false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setExistingLogoName(null);
    reset(emptyBrandingProfileFormValues);
    setShowForm(false);
  };

  useEffect(() => {
    if (!showForm) return;
    // Keep the form scrolled into view when opened from a long list.
    document
      .getElementById("branding-profile-form")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showForm, editingId]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = {
        name: values.name,
        companyName: values.companyName,
        documentOwner: values.documentOwner,
        primaryColor: values.primaryColor,
        accentColor: values.accentColor,
        mutedColor: DEFAULT_MUTED_COLOR,
        lineColor: values.lineColor,
        isDefault: values.isDefault,
      };

      let profileId = editingId;
      if (editingId) {
        await updateProfile({ id: editingId, body: payload }).unwrap();
      } else {
        const created = await createProfile(payload).unwrap();
        profileId = created.id;
      }

      if (profileId && values.removeLogo && !values.logoFile) {
        await clearLogo(profileId).unwrap();
      }
      if (profileId && values.logoFile) {
        await uploadLogo({ id: profileId, file: values.logoFile }).unwrap();
      }

      onSuccess(
        editingId
          ? `Updated branding profile "${payload.name}"`
          : `Created branding profile "${payload.name}"`,
      );
      closeForm();
    } catch (error) {
      onError(getApiErrorMessage(error, "Could not save branding profile"));
    }
  });

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile(deleteTarget.id).unwrap();
      const released = deleteTarget.projectCount;
      onSuccess(
        released > 0
          ? `Deleted "${deleteTarget.name}". ${released} project${released === 1 ? "" : "s"} moved to the default brand.`
          : `Deleted "${deleteTarget.name}"`,
      );
      if (editingId === deleteTarget.id) closeForm();
      setDeleteTarget(null);
    } catch (error) {
      onError(getApiErrorMessage(error, "Could not delete branding profile"));
    }
  };

  const deleteDescription = (() => {
    if (!deleteTarget) return "Delete this branding profile?";
    const used = deleteTarget.projectCount;
    if (used === 0) {
      return `Delete "${deleteTarget.name}"? This cannot be undone.`;
    }
    return `Delete "${deleteTarget.name}"? ${used} project${used === 1 ? "" : "s"} using it will fall back to the default brand on their next report. This cannot be undone.`;
  })();

  const showingExistingLogo =
    Boolean(existingLogoName) && !removeLogo && !logoFile;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/[0.07] dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <Palette className="size-4 text-primary" />
              Branding profiles
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Load each brand once here, then pick it on the project. The report
              template itself never changes — only the letterhead, colours and
              logo do.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="size-4" />
            New brand
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" />
          Loading branding profiles…
        </div>
      ) : profiles.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/[0.1]">
          No branding profiles yet. Create one to start issuing reports under
          your letterhead.
        </div>
      ) : (
        <div className="grid gap-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.07] dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: profile.primaryColor }}
                      title={profile.primaryColor}
                    />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {profile.name}
                    </h3>
                    {profile.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        <Star className="size-3" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {profile.companyName} · {profile.documentOwner}
                  </p>
                  <p className="text-xs text-slate-500">
                    Logo:{" "}
                    {profile.hasLogo
                      ? (profile.logoFileName ?? "Uploaded")
                      : "None"}
                    {" · "}
                    {profile.projectCount === 0
                      ? "No projects"
                      : `${profile.projectCount} project${profile.projectCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(profile)}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-white/[0.08] dark:text-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(profile)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          id="branding-profile-form"
          onSubmit={onSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/[0.07] dark:bg-zinc-950"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? "Edit branding profile" : "New branding profile"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Profile name *
              </label>
              <input
                {...register("name")}
                className={inputClassName}
                placeholder="CyberSec Default"
              />
              {errors.name && (
                <p className="text-[11px] font-semibold text-rose-500">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Company name *
              </label>
              <input {...register("companyName")} className={inputClassName} />
              {errors.companyName && (
                <p className="text-[11px] font-semibold text-rose-500">
                  {errors.companyName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Document owner *
              </label>
              <input
                {...register("documentOwner")}
                className={inputClassName}
                placeholder="CyberSec PMO"
              />
              {errors.documentOwner && (
                <p className="text-[11px] font-semibold text-rose-500">
                  {errors.documentOwner.message}
                </p>
              )}
            </div>

            <Controller
              control={control}
              name="primaryColor"
              render={({ field }) => (
                <ColorField
                  label="Primary colour"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.primaryColor?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="accentColor"
              render={({ field }) => (
                <ColorField
                  label="Accent colour"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.accentColor?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lineColor"
              render={({ field }) => (
                <ColorField
                  label="Line colour"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.lineColor?.message}
                />
              )}
            />

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Logo
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/[0.08] dark:text-slate-200">
                  <Upload className="size-3.5" />
                  {logoFile || showingExistingLogo
                    ? "Replace logo"
                    : "Upload logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setValue("logoFile", file, { shouldValidate: true });
                      setValue("removeLogo", false);
                      event.target.value = "";
                    }}
                  />
                </label>
                {(logoFile || showingExistingLogo) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setValue("logoFile", null, { shouldValidate: true });
                      setValue("removeLogo", true);
                      setExistingLogoName(null);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-white/[0.08] dark:text-slate-200"
                  >
                    Remove logo
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {logoFile
                  ? `Selected: ${logoFile.name}`
                  : showingExistingLogo
                    ? `Current: ${existingLogoName}`
                    : "PNG, JPEG, GIF or WebP · max 2 MB"}
              </p>
              {errors.logoFile && (
                <p className="text-[11px] font-semibold text-rose-500">
                  {errors.logoFile.message}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 md:col-span-2">
              <input type="checkbox" {...register("isDefault")} />
              Use as default for projects without a brand
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/[0.08] dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy && <Spinner size="sm" />}
              {editingId ? "Save changes" : "Create profile"}
            </button>
          </div>
        </form>
      )}

      <DeleteDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title="Delete branding profile"
        description={deleteDescription}
        isDeleting={deleting}
      />
    </div>
  );
}
