// src/components/BusinessIdentity.jsx
// Renders the business-identity elements (phone, address, guarantee, shipping
// cutoff) ONLY for the fields set in src/config/business.js. With the default
// all-null config this returns null and adds nothing to the DOM — so the
// Footer and /contact are byte-identical to before. Never renders a placeholder.
import {
  BUSINESS,
  hasPhone,
  hasAddress,
  hasGuarantee,
  hasShipCutoff,
  hasHours,
  phoneHref,
  shipCutoffStatement,
} from "../config/business";

/**
 * @param {"footer"|"contact"} variant  styling context
 */
export default function BusinessIdentity({ variant = "footer" }) {
  const anything = hasPhone() || hasAddress() || hasGuarantee() || hasShipCutoff() || hasHours();
  if (!anything) return null;

  const wrap =
    variant === "contact"
      ? "mt-4 space-y-3 text-[14px] text-se-bone/60 font-accent"
      : "space-y-1.5 text-[13px] text-se-bone/60 font-accent";

  return (
    <div className={wrap} data-testid="business-identity">
      {hasPhone() && (
        <p>
          <a href={phoneHref()} className="hover:text-se-gold transition">
            {BUSINESS.phone}
          </a>
        </p>
      )}
      {hasAddress() && (
        <address className="not-italic">
          {BUSINESS.addressLines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </address>
      )}
      {hasShipCutoff() && <p>{shipCutoffStatement()}</p>}
      {/* Day-by-day hours table (competitor pattern). Rendered only from real
          configured rows — never a fabricated schedule. */}
      {hasHours() && (
        <table className="text-left" data-testid="business-hours">
          <caption className="sr-only">Business hours</caption>
          <tbody>
            {BUSINESS.hours.map((h) => (
              <tr key={h.day}>
                <th scope="row" className="pr-4 font-normal text-se-steel">{h.day}</th>
                <td>{h.closed ? "Closed" : `${h.opens} – ${h.closes}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasGuarantee() && <p>{BUSINESS.guaranteeDays}-day satisfaction guarantee.</p>}
    </div>
  );
}
