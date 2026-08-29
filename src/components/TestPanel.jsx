// src/components/TestPanel.jsx
// The analytical panel behind a certificate, grouped into three tiers with
// the method reference shown as recorded on each row.
//
// EVERY value — including the count of analyses — is derived from actual
// batch_tests rows. There is no hardcoded panel, no assumed method, and no
// "N analyses" figure that isn't literally rows.length. An empty panel
// renders nothing.
import { groupTestPanel } from "../lib/labVerify";

export default function TestPanel({ tests, compact = false }) {
  const tiers = groupTestPanel(tests);
  if (tiers.length === 0) return null;
  const total = tiers.reduce((n, t) => n + t.tests.length, 0);

  return (
    <section data-testid="test-panel" className="mt-4">
      <h3 className={`font-accent uppercase tracking-[0.14em] text-se-gold ${compact ? "text-[10px]" : "text-[11px]"}`}>
        Analytical panel — {total} {total === 1 ? "analysis" : "analyses"}
      </h3>
      {tiers.map((tier) => (
        <div key={tier.key} className="mt-3">
          <h4 className="text-[11px] font-accent uppercase tracking-[0.12em] text-se-steel">
            {tier.label}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-0 mt-1">
              <caption className="sr-only">{tier.label} analyses for this batch</caption>
              <thead>
                <tr className="text-[10px] font-accent uppercase tracking-[0.12em] text-se-steel">
                  <th scope="col" className="py-1.5 pr-4 border-b border-se-concrete">Test</th>
                  <th scope="col" className="py-1.5 pr-4 border-b border-se-concrete">Method</th>
                  <th scope="col" className="py-1.5 pr-4 border-b border-se-concrete">Result</th>
                  <th scope="col" className="py-1.5 border-b border-se-concrete">Outcome</th>
                </tr>
              </thead>
              <tbody className="text-se-bone/80 font-accent">
                {tier.tests.map((t) => (
                  <tr key={t.id}>
                    <th scope="row" className="py-2 pr-4 border-b border-se-concrete/50 font-normal text-se-bone">
                      {t.test_name}
                    </th>
                    <td className="py-2 pr-4 border-b border-se-concrete/50 font-mono text-[12px]">
                      {t.method_reference || ""}
                    </td>
                    <td className="py-2 pr-4 border-b border-se-concrete/50">
                      {t.result_value ? `${t.result_value}${t.result_unit ? ` ${t.result_unit}` : ""}` : ""}
                    </td>
                    <td className="py-2 border-b border-se-concrete/50">
                      {t.passed === true ? (
                        <span className="text-emerald-300">Meets specification</span>
                      ) : t.passed === false ? (
                        <span className="text-red-300">Does not meet specification</span>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
