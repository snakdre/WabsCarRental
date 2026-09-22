"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators/auth";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("email", data.email);
    const result = await requestPasswordReset(formData);
    if (result?.error) {
      setServerError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="bg-navy border-navy-light">
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-gold text-lg font-semibold">Check your email</p>
          <p className="text-text-muted-wabs text-sm">We sent a password reset link to your email address.</p>
          <a href="/login" className="text-gold text-sm hover:underline block">Back to sign in</a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Reset Password</CardTitle>
        <CardDescription className="text-text-muted-wabs">Enter your email and we&apos;ll send a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input id="email" type="email" {...register("email")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          {serverError && <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
          <a href="/login" className="text-gold text-sm hover:underline block text-center">Back to sign in</a>
        </form>
      </CardContent>
    </Card>
  );
}
