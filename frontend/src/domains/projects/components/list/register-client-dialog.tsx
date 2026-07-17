"use client";

import { useEffect, useState } from "react";
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

interface RegisterClientDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function RegisterClientDialog({
  open,
  onClose,
  onCreated,
}: RegisterClientDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [billingCurrencyId, setBillingCurrencyId] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const {
    data: kekaCurrencies = [],
    isLoading: loadingCurrencies,
    isError: currenciesError,
  } = useGetKekaCurrenciesQuery(undefined, { skip: !open });
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  useEffect(() => {
    if (!open || billingCurrencyId || kekaCurrencies.length === 0) return;
    const preferred =
      kekaCurrencies.find((c) => c.code === "INR") ||
      kekaCurrencies.find((c) => c.code === "USD") ||
      kekaCurrencies[0];
    if (preferred) setBillingCurrencyId(preferred.id);
  }, [open, kekaCurrencies, billingCurrencyId]);

  function reset() {
    setName("");
    setCode("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setDescription("");
    setBillingCurrencyId("");
    setAddressLine1("");
    setAddressLine2("");
    setCountryCode("");
    setCity("");
    setState("");
    setZip("");
  }

  function handleClose() {
    if (isLoading) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Client name is required.");
      return;
    }
    if (!billingCurrencyId) {
      toast.error("Billing currency is required for Keka.");
      return;
    }

    try {
      const created = await createCustomer({
        name: trimmedName,
        code: code.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        billingCurrencyId,
        billingAddress: {
          addressLine1: addressLine1.trim() || undefined,
          addressLine2: addressLine2.trim() || undefined,
          countryCode: countryCode.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
        },
      }).unwrap();

      if (created.kekaSyncError) {
        toast.error(
          `Client saved locally, but Keka create failed: ${created.kekaSyncError}`,
        );
      } else if (created.kekaClientId) {
        toast.success("Client created in PMO and Keka.");
      } else {
        toast.success("Client created.");
      }

      onCreated(created);
      reset();
      onClose();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Failed to create client in PMO / Keka"),
      );
    }
  }

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

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cisco"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Code
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Optional — auto-generated if empty"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Billing currency *
              </label>
              <Select
                value={billingCurrencyId || undefined}
                onValueChange={(value) => {
                  if (typeof value === "string") setBillingCurrencyId(value);
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="optional"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phone
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="optional"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Website
              </label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="optional"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="optional"
                disabled={isLoading}
              />
            </div>

            <div className="rounded-lg border border-slate-200/70 p-3 space-y-3 dark:border-white/[0.08]">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Billing address (optional)
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Address line 1
                </label>
                <Input
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Address line 2
                </label>
                <Input
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    City
                  </label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    State
                  </label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Country code
                  </label>
                  <Input
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    placeholder="e.g. IN"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    ZIP
                  </label>
                  <Input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    disabled={isLoading}
                  />
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
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !name.trim() ||
                  !billingCurrencyId ||
                  loadingCurrencies
                }
              >
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
