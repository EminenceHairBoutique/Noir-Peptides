export async function generateOrderNumber(supabase) {
  const { count, error } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  if (error) throw error;

  return `EM-${100000 + (count || 0) + 1}-${Date.now().toString().slice(-4)}`;
}
