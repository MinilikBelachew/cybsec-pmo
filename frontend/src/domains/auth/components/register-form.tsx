"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { useAppDispatch } from "@/store/hooks";
import { logger } from "@/core/logger";
import { normalizeError } from "@/core/errors/normalize-error";
import { useRegisterMutation } from "../api/auth.api";
import { registerService } from "../services/auth.service";
import { registerSchema, type RegisterFormValues } from "../schemas/auth.schema";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/forms/form-field";
import { Eye, EyeOff } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [registerMutation, { isLoading }] = useRegisterMutation();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setError(null);
    try {
      await registerService(
        (args) => registerMutation(args).unwrap(),
        values,
        dispatch,
        logger
      );
      router.push("/dashboard");
    } catch (err) {
      setError(normalizeError(err).message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        id="name"
        type="text"
        label="Full Name"
        placeholder="Jane Doe"
        error={errors.name?.message}
        {...register("name")}
      />

      <FormField
        id="reg-email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="relative">
        <FormField
          id="reg-password"
          type={showPassword ? "text" : "password"}
          label="Password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-[22px] h-9 w-9 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
        </Button>
      </div>

      <div className="relative">
        <FormField
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          label="Confirm Password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      <Button id="register-submit" type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
