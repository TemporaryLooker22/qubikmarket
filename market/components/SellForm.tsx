"use client";

import { useActionState } from "react";
import { publishResource } from "@/app/actions";
import { ALLOWED_EXTENSIONS, CATEGORIES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { SubmitButton } from "./SubmitButton";

export function SellForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(publishResource, undefined);

  return (
    <form action={action}>
      {state?.error && <p role="alert">{state.error}</p>}

      <p>
        <label htmlFor="title">{t.sell.fTitle}</label>
        <br />
        <input id="title" name="title" required maxLength={80} placeholder={t.sell.fTitlePh} />
      </p>

      <p>
        <label htmlFor="summary">{t.sell.fSummary}</label>
        <br />
        <input id="summary" name="summary" required maxLength={160} placeholder={t.sell.fSummaryPh} />
      </p>

      <p>
        <label htmlFor="description">{t.sell.fDescription}</label>
        <br />
        <textarea id="description" name="description" required rows={7} placeholder={t.sell.fDescriptionPh} />
      </p>

      <p>
        <label htmlFor="category">{t.sell.fCategory}</label>
        <br />
        <select id="category" name="category" required defaultValue="">
          <option value="" disabled>{t.sell.fCategoryPh}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </p>

      <p>
        <label htmlFor="price">{t.sell.fPrice}</label>
        <br />
        <input id="price" name="price" type="number" min={0} max={500} step="0.01" defaultValue={0} required />
      </p>

      <p>
        <label htmlFor="file">{t.sell.fFile(ALLOWED_EXTENSIONS.join(", "))}</label>
        <br />
        <input id="file" name="file" type="file" required accept={ALLOWED_EXTENSIONS.join(",")} />
      </p>

      <p>{t.sell.next}</p>
      <ul>
        <li>{t.sell.nextClean}</li>
        <li>{t.sell.nextSuspicious}</li>
        <li>{t.sell.nextDangerous}</li>
      </ul>

      <SubmitButton pendingText={t.sell.submitting}>{t.sell.submit}</SubmitButton>
    </form>
  );
}
