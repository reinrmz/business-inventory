"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { switchBusiness } from "./(auth)/actions";

type Business = { id: number; name: string };

const NEW_BUSINESS_VALUE = "__new__";

export function BusinessSwitcherSelect({
  businesses,
  currentBusinessId,
}: {
  businesses: Business[];
  currentBusinessId: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleChange(value: string) {
    if (value === NEW_BUSINESS_VALUE) {
      router.push("/businesses/new");
      return;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form action={switchBusiness} ref={formRef} className="flex items-center gap-2">
      <select
        name="businessId"
        defaultValue={currentBusinessId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-border bg-bg px-2 py-1 text-xs outline-none focus:border-accent"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        <option value={NEW_BUSINESS_VALUE}>+ New business…</option>
      </select>
    </form>
  );
}
