import * as React from "react";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ id, label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className={cn(error && "text-destructive")}>
          {label}
        </Label>
        <Input
          id={id}
          ref={ref}
          className={cn(error && "border-destructive focus-visible:ring-destructive", className)}
          {...props}
        />
        {error && <p className="text-[0.8rem] font-medium text-destructive">{error}</p>}
      </div>
    );
  }
);
FormField.displayName = "FormField";
