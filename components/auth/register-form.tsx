"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.append(k, v));
    const result = await signUp(formData);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Create Account</CardTitle>
        <CardDescription className="text-text-muted-wabs">Join Wabs Car Rental</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-white">First Name</Label>
              <Input id="firstName" {...register("firstName")}
                className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
              {errors.firstName && <p className="text-red-400 text-xs">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-white">Last Name</Label>
              <Input id="lastName" {...register("lastName")}
                className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
              {errors.lastName && <p className="text-red-400 text-xs">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input id="email" type="email" {...register("email")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">Password</Label>
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
          {serverError && (
            <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>
          )}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Creating account..." : "Create Account"}
          </Button>
          <p className="text-center text-text-muted-wabs text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-gold hover:underline">Sign in</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
