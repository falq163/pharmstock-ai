// lib/supabase.js
// ============================================================
// PHARMSTOCK AI — Supabase Client
// ============================================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('❌ Missing Supabase env variables! Check .env.local')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ============================================================
// DRUGS
// ============================================================

/** Ambil semua obat */
export const getDrugs = async () => {
  const { data, error } = await supabase
    .from('drugs')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

/** Subscribe real-time perubahan stok */
export const subscribeDrugs = (callback) => {
  return supabase
    .channel('drugs-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drugs' }, callback)
    .subscribe()
}

// ============================================================
// TRANSACTIONS
// ============================================================

/** Submit transaksi baru (kasir) */
export const submitTransaction = async ({ staffName, items }) => {
  // 1. Buat header transaksi
  const total = items.reduce((s, i) => s + i.price_per_unit * i.qty, 0)

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({ staff_name: staffName, total })
    .select()
    .single()

  if (txError) throw txError

  // 2. Insert semua item
  const txItems = items.map(i => ({
    transaction_id: tx.id,
    drug_id:        i.drug_id,
    drug_name:      i.drug_name,
    qty:            i.qty,
    price_per_unit: i.price_per_unit,
    subtotal:       i.price_per_unit * i.qty
  }))

  const { error: itemError } = await supabase
    .from('transaction_items')
    .insert(txItems)

  if (itemError) throw itemError

  // Stok otomatis berkurang via trigger di database ✅
  return tx
}

/** Ambil transaksi hari ini */
export const getTodayTransactions = async () => {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('transactions')
    .select('*, transaction_items(*)')
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** Subscribe real-time transaksi baru */
export const subscribeTransactions = (callback) => {
  return supabase
    .channel('tx-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, callback)
    .subscribe()
}

// ============================================================
// DASHBOARD VIEWS
// ============================================================

/** Revenue hari ini */
export const getTodayRevenue = async () => {
  const { data, error } = await supabase
    .from('today_revenue')
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Stok kritis */
export const getCriticalStock = async () => {
  const { data, error } = await supabase
    .from('critical_stock')
    .select('*')
  if (error) throw error
  return data
}

/** Top penjualan hari ini */
export const getTopSelling = async () => {
  const { data, error } = await supabase
    .from('top_selling_today')
    .select('*')
  if (error) throw error
  return data
}

/** Revenue per jam hari ini */
export const getHourlyRevenue = async () => {
  const { data, error } = await supabase
    .from('hourly_revenue_today')
    .select('*')
  if (error) throw error
  return data
}

// ============================================================
// RESTOCK
// ============================================================

/** Tambah stok (restock) */
export const restockDrug = async ({ drugId, drugName, qty, staffName }) => {
  // Log dulu
  const { data: drug } = await supabase
    .from('drugs')
    .select('stock')
    .eq('id', drugId)
    .single()

  await supabase.from('stock_logs').insert({
    drug_id:      drugId,
    drug_name:    drugName,
    type:         'restock',
    qty_change:   qty,
    stock_before: drug.stock,
    stock_after:  drug.stock + qty,
    staff_name:   staffName
  })

  // Update stok
  const { error } = await supabase
    .from('drugs')
    .update({ stock: drug.stock + qty })
    .eq('id', drugId)

  if (error) throw error
}
