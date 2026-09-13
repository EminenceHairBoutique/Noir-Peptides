// scripts/_admin-stub-auth.mjs — requireAdmin stand-in for handler tests.
export async function requireAdmin() { return { id: "admin-test", email: "admin@example.test" }; }
export async function requireUser() { return { id: "user-test" }; }
export async function requirePartner() { return { id: "partner-test" }; }
