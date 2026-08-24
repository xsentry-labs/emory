"use client";

import { useState } from "react";
import { REPLACEMENT_LINES } from "@/lib/agents";
import { money } from "@/lib/utils";

/** Interactive, so the reader supplies their own numbers and convinces themselves. */
export function ReplacementCalculator() {
  const [amounts, setAmounts] = useState<Record<string, number>>(
    Object.fromEntries(REPLACEMENT_LINES.map((line) => [line.label, line.amount])),
  );

  const total = Object.values(amounts).reduce((sum, value) => sum + value, 0);
  const difference = total - 229;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-line bg-paper">
        <table className="w-full text-left">
          <caption className="sr-only">
            What a marketing stack costs each month. Change any number to your own.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 text-caption font-medium text-mute">
                What you pay for now
              </th>
              <th scope="col" className="px-5 py-3 text-caption font-medium text-mute">
                A month
              </th>
              <th scope="col" className="hidden px-5 py-3 text-caption font-medium text-mute sm:table-cell">
                Handled instead by
              </th>
            </tr>
          </thead>
          <tbody>
            {REPLACEMENT_LINES.map((line) => (
              <tr key={line.label} className="border-b border-line last:border-0">
                <th scope="row" className="px-5 py-3 text-left text-sm font-normal text-ink">
                  {line.label}
                  {line.absent ? (
                    <span className="ml-2 text-caption text-mute">usually nobody</span>
                  ) : null}
                </th>
                <td className="px-5 py-3">
                  <label className="sr-only" htmlFor={`amt-${line.label}`}>
                    {line.label} monthly cost
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-mute">$</span>
                    <input
                      id={`amt-${line.label}`}
                      type="number"
                      min={0}
                      step={10}
                      value={amounts[line.label]}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [line.label]: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      className="w-24 rounded border border-line bg-paper px-2 py-1 text-sm tabular-nums text-ink transition-colors hover:border-ink/30 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/12"
                    />
                  </div>
                </td>
                <td className="hidden px-5 py-3 text-sm text-mute sm:table-cell">
                  {line.replacedBy}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink">
              <th scope="row" className="px-5 py-4 text-left text-sm font-medium text-ink">
                Your total
              </th>
              <td className="px-5 py-4 text-sm font-medium tabular-nums text-ink" colSpan={2}>
                {money(total)} a month
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-lg border border-ink bg-paper p-6">
        <p className="label">Emory Complete</p>
        <p className="mt-2 font-display text-display font-medium tabular-nums text-ink">
          $229<span className="text-body text-mute"> a month</span>
        </p>
        <p className="mt-4 text-body text-mute">
          All eleven agents. The tooling above is included; the work those people were doing is what
          Emory takes on.
        </p>
        <div className="mt-6 rule pt-4">
          <p className="text-sm text-ink">
            {difference > 0
              ? `That is ${money(difference)} a month of your own numbers, against $229.`
              : "Put your own numbers in above and see where you land."}
          </p>
          <p className="mt-2 text-caption text-mute">
            Ad spend and message fees sit on top of both columns. Emory takes no margin on message
            rails.
          </p>
        </div>
      </div>
    </div>
  );
}
