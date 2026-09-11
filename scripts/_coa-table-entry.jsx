// Test entry: re-exports the real certificate-table components so
// scripts/test-coa-table-render.mjs can render them. MemoryRouter is bundled
// here because <CoaCard> may render a <Link>. Not shipped.
import { MemoryRouter } from "react-router-dom";
export { MemoryRouter };
export { default as BatchHistoryTable } from "../src/components/BatchHistoryTable.jsx";
export { default as CoaCard } from "../src/components/CoaCard.jsx";
