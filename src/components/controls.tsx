"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubmitButton({ idle, pending, className = "button primary", disabled = false }: { idle: string; pending: string; className?: string; disabled?: boolean }) {
  const status = useFormStatus();
  return <button className={className} disabled={status.pending || disabled}>{status.pending ? pending : idle}</button>;
}

function PendingButton({ idle, pending, className }: { idle: string; pending: string; className: string }) {
  const status = useFormStatus();
  return <button className={className} disabled={status.pending}>{status.pending ? pending : idle}</button>;
}

export function ConfirmButton({
  action,
  fields,
  idle,
  pending,
  title,
  body,
  className = "button primary",
  disabled = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  idle: string;
  pending: string;
  title: string;
  body: string;
  className?: string;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => dialog.current?.showModal()}>{idle}</button>
      <dialog ref={dialog} className="confirm" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <form action={action} className="confirmCard">
          {fields && Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <h2>{title}</h2>
          <p>{body}</p>
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>Back</button>
            <PendingButton idle={idle} pending={pending} className="button primary" />
          </div>
        </form>
      </dialog>
    </>
  );
}

export function PrintButton() {
  return <button type="button" className="button secondary noPrint" onClick={() => window.print()}>Print</button>;
}

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return <Link href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{children}</Link>;
}
