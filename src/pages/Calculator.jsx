// src/pages/Calculator.jsx — Reconstitution / concentration reference.
// PURE laboratory mass÷volume math only. No body-weight inputs, no dosing,
// administration, or in-vivo guidance — a unit-conversion aid for aliquoting
// research reference material. Claim-safe / RUO.
import React, { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";

const DRAW_VOLUMES_ML = [0.05, 0.1, 0.25, 0.5, 1.0];

export default function Calculator() {
  const [peptideMg, setPeptideMg] = useState("5");
  const [solventMl, setSolventMl] = useState("2");

  const mg = Number(peptideMg);
  const ml = Number(solventMl);
  const concentration = useMemo(
    () => (mg > 0 && ml > 0 ? mg / ml : null),
    [mg, ml]
  );

  return (
    <>
      <SEO
        title="Reconstitution Concentration Calculator | Noir Peptides"
        description="A laboratory mass-per-volume concentration reference for aliquoting research reference material. Pure mg ÷ mL math. For research use only."
      />
      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-8 md:pt-40 border-b border-se-concrete">
          <div className="content-wrap max-w-3xl">
            <p className="text-overline mb-2">Laboratory Tool</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,5vw,3rem)] leading-[0.95]">
              CONCENTRATION CALCULATOR
            </h1>
            <p className="text-[14px] text-se-bone/50 mt-4 font-accent">
              A pure mass-per-volume reference (mg ÷ mL) for aliquoting research
              reference material. No body-weight, dosing, or administration
              inputs — concentration math only.
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wrap max-w-3xl">
            <DisclaimerBanner className="mb-8" />

            <div className="glass-panel p-6 md:p-8 grid sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="pep"
                  className="text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2"
                >
                  Peptide in vial (mg)
                </label>
                <input
                  id="pep"
                  type="number"
                  min="0"
                  step="0.5"
                  inputMode="decimal"
                  value={peptideMg}
                  onChange={(e) => setPeptideMg(e.target.value)}
                  className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[15px] font-accent focus:outline-none focus:border-se-gold transition"
                />
              </div>
              <div>
                <label
                  htmlFor="sol"
                  className="text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2"
                >
                  Solvent added (mL)
                </label>
                <input
                  id="sol"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={solventMl}
                  onChange={(e) => setSolventMl(e.target.value)}
                  className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[15px] font-accent focus:outline-none focus:border-se-gold transition"
                />
              </div>
            </div>

            <div className="glass-panel p-6 md:p-8 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="w-4 h-4 text-se-gold" />
                <h2 className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-gold">
                  Resulting Concentration
                </h2>
              </div>
              {concentration ? (
                <>
                  <p className="font-display text-[clamp(1.8rem,5vw,2.6rem)] text-se-bone">
                    {concentration.toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })}{" "}
                    <span className="text-se-steel text-[16px] font-accent">mg / mL</span>
                  </p>
                  <p className="text-[12px] text-se-steel font-accent mt-1">
                    {(concentration * 1000).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    mcg / mL
                  </p>

                  <table className="w-full mt-6 text-[13px] font-accent">
                    <thead>
                      <tr className="text-se-steel text-[10px] uppercase tracking-[0.14em]">
                        <th className="text-left py-2">Aliquot volume</th>
                        <th className="text-right py-2">Peptide mass</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DRAW_VOLUMES_ML.map((v) => (
                        <tr key={v} className="border-t border-se-concrete/50">
                          <td className="py-2 text-se-bone/70">{v} mL</td>
                          <td className="py-2 text-right text-se-bone">
                            {(concentration * v).toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            })}{" "}
                            mg
                            <span className="text-se-steel">
                              {" "}
                              ({(concentration * v * 1000).toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}{" "}
                              mcg)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="text-[13px] text-se-steel font-accent">
                  Enter a peptide mass and solvent volume above.
                </p>
              )}
            </div>

            <p className="text-[11px] text-se-steel/70 font-accent mt-6 leading-relaxed">
              This tool performs unit conversion only and is provided for
              laboratory aliquoting reference. It is not guidance for human or
              veterinary use. Handling and preparation follow your institution's
              standard operating procedures.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
