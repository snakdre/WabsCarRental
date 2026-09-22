"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    const result = await signIn(formData);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Sign In</CardTitle>
        <CardDescription className="text-text-muted-wabs">Welcome back to Wabs Car Rental</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input id="email" type="email" {...register("email")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold"
              placeholder="you@example.com" />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">Password</Label>
            <Input id="password" type="password" {...register("password")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
          {serverError && (
            <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>
          )}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <div className="text-center space-y-2">
            <a href="/forgot-password" className="text-gold text-sm hover:underline block">
              Forgot your password?
            </a>
            <p className="text-text-muted-wabs text-sm">
              No account?{" "}
              <a href="/register" className="text-gold hover:underline">Create one</a>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
