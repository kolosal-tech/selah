"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useMessages } from "@/i18n/client";

type PasswordFieldProps = {
  name: string;
  label: string;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
};

export function PasswordField({
  name,
  label,
  placeholder,
  autoComplete,
  minLength,
}: PasswordFieldProps) {
  const m = useMessages();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const libelleBouton = visible
    ? m.auth.masquerMotDePasse
    : m.auth.afficherMotDePasse;

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="glass-input w-full rounded-xl p-3 pe-12 placeholder:text-white/40"
      />
      <button
        type="button"
        onClick={() => setVisible((actuel) => !actuel)}
        aria-label={libelleBouton}
        aria-pressed={visible}
        title={libelleBouton}
        className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-e-xl text-white/60 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-amber-300"
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
