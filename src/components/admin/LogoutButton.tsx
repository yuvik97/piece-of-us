"use client";
export function LogoutButton() {
  return (
    <button className="mt-3 text-muted underline-offset-4 hover:text-ink hover:underline" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); location.href = "/admin/login"; }}>
      Sign out
    </button>
  );
}
