import { supabase } from './supabase'
import { Bag, BagDisc, BagWithDiscs, Plastic, Weight, Wear } from '../types'

// ---------- Mappers ----------

interface BagRow {
  id: string
  user_id: string
  name: string
  is_default: boolean
  created_at: string
}

interface BagDiscRow {
  id: string
  bag_id: string
  disc_name: string
  plastic: string
  weight: string
  wear: string
  photo_path: string | null
  position: number
}

function rowToBag(r: BagRow): Bag {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    isDefault: r.is_default,
    createdAt: r.created_at,
  }
}

function rowToBagDisc(r: BagDiscRow): BagDisc {
  return {
    id: r.id,
    bagId: r.bag_id,
    discName: r.disc_name,
    plastic: r.plastic as Plastic,
    weight: r.weight as Weight,
    wear: r.wear as Wear,
    photoPath: r.photo_path,
    position: r.position,
  }
}

// ---------- Bag CRUD ----------

export async function listBags(): Promise<Bag[]> {
  const { data, error } = await supabase
    .from('bags')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToBag)
}

export async function createBag(name: string, isDefault = false): Promise<Bag> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('bags')
    .insert({ user_id: user.id, name, is_default: isDefault })
    .select('*')
    .single()
  if (error) throw error
  return rowToBag(data)
}

export async function renameBag(bagId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('bags')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', bagId)
  if (error) throw error
}

export async function deleteBag(bagId: string): Promise<void> {
  const { error } = await supabase.from('bags').delete().eq('id', bagId)
  if (error) throw error
}

export async function setDefaultBag(bagId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error('Not signed in')

  // Clear current default, then set the new one.
  await supabase
    .from('bags')
    .update({ is_default: false })
    .eq('user_id', user.id)
  const { error } = await supabase
    .from('bags')
    .update({ is_default: true })
    .eq('id', bagId)
  if (error) throw error
}

// ---------- Bag-disc CRUD ----------

export async function listDiscsInBag(bagId: string): Promise<BagDisc[]> {
  const { data, error } = await supabase
    .from('bag_discs')
    .select('*')
    .eq('bag_id', bagId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToBagDisc)
}

export async function fetchBagWithDiscs(bagId: string): Promise<BagWithDiscs | null> {
  const { data: bagData, error: bagErr } = await supabase
    .from('bags')
    .select('*')
    .eq('id', bagId)
    .maybeSingle()
  if (bagErr) throw bagErr
  if (!bagData) return null
  const discs = await listDiscsInBag(bagId)
  return { ...rowToBag(bagData), discs }
}

export async function addDiscToBag(
  bagId: string,
  patch: {
    discName: string
    plastic: Plastic
    weight: Weight
    wear: Wear
    position?: number
  },
): Promise<BagDisc> {
  const { data, error } = await supabase
    .from('bag_discs')
    .insert({
      bag_id: bagId,
      disc_name: patch.discName,
      plastic: patch.plastic,
      weight: patch.weight,
      wear: patch.wear,
      position: patch.position ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToBagDisc(data)
}

export async function updateBagDisc(
  discId: string,
  patch: Partial<{
    discName: string
    plastic: Plastic
    weight: Weight
    wear: Wear
    photoPath: string | null
    position: number
  }>,
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.discName !== undefined) update.disc_name = patch.discName
  if (patch.plastic !== undefined) update.plastic = patch.plastic
  if (patch.weight !== undefined) update.weight = patch.weight
  if (patch.wear !== undefined) update.wear = patch.wear
  if (patch.photoPath !== undefined) update.photo_path = patch.photoPath
  if (patch.position !== undefined) update.position = patch.position

  const { error } = await supabase
    .from('bag_discs')
    .update(update)
    .eq('id', discId)
  if (error) throw error
}

export async function removeDiscFromBag(discId: string): Promise<void> {
  const { error } = await supabase.from('bag_discs').delete().eq('id', discId)
  if (error) throw error
}
