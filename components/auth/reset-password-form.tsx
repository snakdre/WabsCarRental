"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";
import { resetPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);
    const result = await resetPassword(formData);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Set New Password</CardTitle>
        <CardDescription className="text-text-muted-wabs">Choose a strong password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">New Password</Label>
            <Input id="password" type="password" {...register("password")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
          </div>
          {serverError && <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
