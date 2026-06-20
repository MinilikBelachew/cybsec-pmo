"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { Eye, EyeOff } from "lucide-react";

import { loginSchema, type LoginFormValues } from "../schemas/auth.schema";
import { useLogin } from "../hooks/use-login";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/forms/form-field";

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading, error } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      router.push("/dashboard");
    } catch {
      // error is already captured in useLogin
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        id="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="relative">
        <FormField
          id="password"
          type={showPassword ? "text" : "password"}
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
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

      {error && (
        <div className="text-sm font-medium text-destructive">{error}</div>
      )}

      <Button
        id="login-submit"
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
