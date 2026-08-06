"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions/profile";
import { AGE_GROUPS, COUNTRIES, CREATIVE_FIELDS, GENDERS } from "@/lib/constants";
import { PillSelect } from "@/components/ui/pill-select";
import { Button } from "@/components/ui/button";
import type { AgeGroup, CreativeField, Gender } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [country, setCountry] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [occupation, setOccupation] = useState("");
  const [creativeField, setCreativeField] = useState<CreativeField | null>(null);

  function finish() {
    startTransition(async () => {
      await updateProfile({
        country,
        ageGroup,
        gender,
        occupation: occupation || null,
        creativeField,
        onboarded: true,
      });
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Tell us about you</h1>
      <p className="mt-1.5 text-sm text-muted">
        Completely optional — helps break results down by who&apos;s voting. Skip anything you&apos;d rather not share.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Country</h2>
          <PillSelect
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            value={country}
            onChange={setCountry}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Age group</h2>
          <PillSelect options={AGE_GROUPS} value={ageGroup} onChange={setAgeGroup} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Gender</h2>
          <PillSelect options={GENDERS} value={gender} onChange={setGender} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Occupation</h2>
          <input
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g. Product Designer"
            className="h-11 w-full rounded-full border border-border bg-surface px-4 text-[15px] outline-none placeholder:text-muted focus:border-accent"
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Creative field</h2>
          <PillSelect
            options={CREATIVE_FIELDS}
            value={creativeField}
            onChange={setCreativeField}
          />
        </section>
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={finish} disabled={isPending}>
          Skip for now
        </Button>
        <Button onClick={finish} disabled={isPending} size="lg" className="flex-1">
          {isPending ? "Saving…" : "Done"}
        </Button>
      </div>
    </div>
  );
}
