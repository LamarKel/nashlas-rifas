import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const WHATSAPP = '18299278707'
export const WHATSAPP_LABEL = '+1 (829) 927-8707'
export const INSTAGRAM = 'https://www.instagram.com/nashlasshop/'

export const money = (n) =>
  'RD$ ' + Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const pad = (n, total) => String(n).padStart(String(Math.max(total - 1, 0)).length, '0')

export const soloDigitos = (s) => (s || '').replace(/\D/g, '').slice(-10)
