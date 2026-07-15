"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import { useCreateCustomerMutation } from "@/domains/projects/api/projects.api";
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
  const [description, setDescription] = useState("");
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  function reset() {
    setName("");
    setCode("");
    setEmail("");
    setPhone("");
    setDescription("");
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

    try {
      const created = await createCustomer({
        name: trimmedName,
        code: code.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        description: description.trim() || undefined,
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
            "fixed left-1/2 top-1/2 z-[90] max-h-[85vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-6 text-slate-900 shadow-xl transition duration-200 ease-in-out dark:border-white/[0.08] dark:bg-slate-950 dark:text-white data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <DialogPrimitive.Title className="text-base font-bold text-foreground">
            Register client
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
            Creates the client in PMO and in Keka PSA (name + code required by Keka).
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
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="optional"
                disabled={isLoading}
              />
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
              <Button type="submit" disabled={isLoading || !name.trim()}>
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
