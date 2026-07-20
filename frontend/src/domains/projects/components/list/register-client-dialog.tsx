"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import {
  useCreateCustomerMutation,
  useGetKekaCurrenciesQuery,
} from "@/domains/projects/api/projects.api";
import { getApiErrorMessage } from "@/core/errors/api-error";
import type { Customer } from "@/domains/projects/types/projects.types";
import {
  registerClientFormSchema,
  toCreateCustomerPayload,
  type RegisterClientFormValues,
} from "@/domains/projects/schemas/customer/register-client.schema";

interface RegisterClientDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

const DEFAULT_VALUES: RegisterClientFormValues = {
  name: "",
  code: "",
  email: "",
  phone: "",
  website: "",
  description: "",
  billingCurrencyId: "",
  addressLine1: "",
  addressLine2: "",
  countryCode: "",
  city: "",
  state: "",
  zip: "",
};

export function RegisterClientDialog({
  open,
  onClose,
  onCreated,
}: RegisterClientDialogProps) {
  const {
    data: kekaCurrencies = [],
    isLoading: loadingCurrencies,
    isError: currenciesError,
  } = useGetKekaCurrenciesQuery(undefined, { skip: !open });
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterClientFormValues>({
    resolver: zodResolver(registerClientFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const billingCurrencyId = watch("billingCurrencyId");

  useEffect(() => {
    if (!open || billingCurrencyId || kekaCurrencies.length === 0) return;
    const preferred =
      kekaCurrencies.find((c) => c.code === "USD") ||
      kekaCurrencies.find((c) => c.code === "INR") ||
      kekaCurrencies[0];
    if (preferred) {
      setValue("billingCurrencyId", preferred.id, { shouldValidate: false });
    }
  }, [open, kekaCurrencies, billingCurrencyId, setValue]);

  function handleClose() {
    if (isLoading) return;
    reset(DEFAULT_VALUES);
    onClose();
  }

  const onSubmit = handleSubmit(async (values) => {
    const parsed = registerClientFormSchema.parse(values);
    try {
      const created = await createCustomer(toCreateCustomerPayload(parsed)).unwrap();

      if (created.kekaSyncError) {
        toast.error(
          `Client saved locally, but Keka create failed: ${created.kekaSyncError}. Retry from Integrations → Keka.`,
        );
      } else if (created.kekaClientId) {
        toast.success("Client created in PMO and Keka.");
      } else {
        toast.success("Client created.");
      }

      onCreated(created);
      reset(DEFAULT_VALUES);
      onClose();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Failed to create client in PMO / Keka"),
      );
    }
  });

  const selectedCurrency = kekaCurrencies.find((c) => c.id === billingCurrencyId);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-[90] bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[90] max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-6 text-slate-900 shadow-xl transition duration-200 ease-in-out dark:border-white/[0.08] dark:bg-slate-950 dark:text-white data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <DialogPrimitive.Title className="text-base font-bold text-foreground">
            Register client
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
            Creates the client in PMO and in Keka PSA. Billing currency is required by Keka.
          </DialogPrimitive.Description>

          <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Name *
              </label>
              <Input
                {...register("name")}
                placeholder="e.g. Cisco"
                disabled={isLoading}
                autoFocus
              />
              {errors.name && (
                <p className="text-[11px] font-semibold text-rose-500">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Code
              </label>
              <Input
                {...register("code")}
                placeholder="Optional — auto-generated if empty"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Billing currency *
              </label>
              <Controller
                control={control}
                name="billingCurrencyId"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => {
                      if (typeof value === "string") field.onChange(value);
                    }}
                    disabled={isLoading || loadingCurrencies || kekaCurrencies.length === 0}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm">
                      <SelectValue placeholder={loadingCurrencies ? "Loading currencies…" : "Select currency…"}>
                        {selectedCurrency
                          ? `${selectedCurrency.code} — ${selectedCurrency.name}`
                          : loadingCurrencies
                            ? "Loading currencies…"
                            : "Select currency…"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      alignItemWithTrigger={false}
                      positionerClassName="z-[120]"
                      className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg"
                    >
                      {kekaCurrencies.map((currency) => (
                        <SelectItem key={currency.id} value={currency.id}>
                          {currency.code} — {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.billingCurrencyId && (
                <p className="text-[11px] font-semibold text-rose-500">
                  {errors.billingCurrencyId.message}
                </p>
              )}
              {currenciesError && (
                <p className="text-[11px] font-semibold text-rose-500">
                  Could not load Keka currencies. Check Keka integration credentials.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="optional"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-[11px] font-semibold text-rose-500">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phone
                </label>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/[^0-9+\-\s().]/g, ""))
                      }
                      onBlur={field.onBlur}
                      placeholder="optional"
                      disabled={isLoading}
                    />
                  )}
                />
                {errors.phone && (
                  <p className="text-[11px] font-semibold text-rose-500">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Website
              </label>
              <Input
                {...register("website")}
                placeholder="optional"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description
              </label>
              <Input
                {...register("description")}
                placeholder="optional"
                disabled={isLoading}
              />
            </div>

            <div className="rounded-lg border border-slate-200/70 p-3 space-y-3 dark:border-white/[0.08]">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Billing address *
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Address line 1 *
                </label>
                <Input {...register("addressLine1")} disabled={isLoading} />
                {errors.addressLine1 && (
                  <p className="text-[11px] font-semibold text-rose-500">
                    {errors.addressLine1.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Address line 2
                </label>
                <Input {...register("addressLine2")} disabled={isLoading} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    City *
                  </label>
                  <Input {...register("city")} disabled={isLoading} />
                  {errors.city && (
                    <p className="text-[11px] font-semibold text-rose-500">
                      {errors.city.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    State *
                  </label>
                  <Input {...register("state")} disabled={isLoading} />
                  {errors.state && (
                    <p className="text-[11px] font-semibold text-rose-500">
                      {errors.state.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Country code *
                  </label>
                  <Input
                    {...register("countryCode")}
                    placeholder="e.g. IN"
                    maxLength={2}
                    disabled={isLoading}
                  />
                  {errors.countryCode && (
                    <p className="text-[11px] font-semibold text-rose-500">
                      {errors.countryCode.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    ZIP *
                  </label>
                  <Input {...register("zip")} disabled={isLoading} />
                  {errors.zip && (
                    <p className="text-[11px] font-semibold text-rose-500">
                      {errors.zip.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || loadingCurrencies}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create client"
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
