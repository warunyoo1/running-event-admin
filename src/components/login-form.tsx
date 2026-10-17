"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { authApi } from "@/lib/api";
import { resetUnauthorized } from "@/lib/api/client";
import { fieldErrorsFor, formMessage } from "@/lib/api/errors";
import { safeNext } from "@/lib/safe-next";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFields({});
    try {
      await authApi.login({ email: email.trim(), password });
      resetUnauthorized();
      router.replace(safeNext(params.get("next")));
    } catch (reason) {
      setFields(fieldErrorsFor(reason));
      setError(formMessage(reason));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        <label className="full">
          อีเมล
          <input
            autoFocus
            required
            type="email"
            autoComplete="username"
            maxLength={200}
            value={email}
            aria-invalid={Boolean(fields.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fields.email && <span className="form-error">{fields.email}</span>}
        </label>
        <label className="full">
          รหัสผ่าน
          <input
            required
            type="password"
            autoComplete="current-password"
            maxLength={200}
            value={password}
            aria-invalid={Boolean(fields.password)}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fields.password && <span className="form-error">{fields.password}</span>}
        </label>
      </div>
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
