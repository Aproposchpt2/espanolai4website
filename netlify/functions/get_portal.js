'use strict';
// get_portal.js — uses direct REST fetch (no Supabase JS client, no WebSocket dependency)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

const ENTREPRENEUR_TOTAL_BUILDS = 5;

function sbHeaders() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

async function sbGet(table, email, extra = '') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?email=ilike.${encodeURIComponent(email)}&order=created_at.desc${extra}`,
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function normalizeEmail(v = '') { return String(v || '').trim().toLowerCase(); }
function normalizeStatus(v = '') { return String(v || '').trim().toLowerCase(); }

function isActiveStatus(v = '') {
  const s = normalizeStatus(v);
  if (!s) return true;
  return !['cancelled','canceled','deleted','failed','expired','inactive'].includes(s);
}

function numberOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function getPlanKey(row = {}) {
  const raw = [row.plan_key, row.plan_name, row.package, row.package_name, row.support_tier, row.stripe_product_name]
    .filter(Boolean).join(' ').toLowerCase();
  if (raw.includes('entrepreneur') || raw.includes('pro')) return 'entrepreneur';
  if (raw.includes('premier') || raw.includes('premium')) return 'premier';
  if (raw.includes('founder') || raw.includes('starter')) return 'founder';
  return 'unknown';
}

function getLatestActive(rows = []) {
  const usable = (Array.isArray(rows) ? rows : []).filter(r => isActiveStatus(r.status || r.stripe_status));
  usable.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  return usable[0] || null;
}

function getSubscriptionUpdateAllowance(sub = null) {
  if (!sub) return null;
  const explicit = numberOrNull(sub.monthly_update_limit) || numberOrNull(sub.updates_allowed) || numberOrNull(sub.update_limit);
  if (explicit !== null) return explicit;
  const pk = getPlanKey(sub);
  if (pk === 'entrepreneur') return 25;
  if (pk === 'premier') return 5;
  return null;
}

function getBuildSummary(order = null, sites = []) {
  if (!order) return { allowed: 0, used: 0, remaining: 0, source: 'no_package' };
  const pk = getPlanKey(order);
  const allowedFromOrder = numberOrNull(order.sites_purchased) || numberOrNull(order.builds_allowed) || numberOrNull(order.total_builds);
  const allowed = pk === 'entrepreneur' ? ENTREPRENEUR_TOTAL_BUILDS : (allowedFromOrder || 1);
  const usedFromOrder = numberOrNull(order.sites_used) || numberOrNull(order.builds_used);
  const remainingFromOrder = numberOrNull(order.sites_remaining) || numberOrNull(order.builds_remaining);
  let used, remaining, source;
  if (remainingFromOrder !== null) {
    remaining = Math.max(0, Math.min(allowed, remainingFromOrder));
    used = Math.max(0, allowed - remaining);
    source = 'order_remaining';
  } else if (usedFromOrder !== null) {
    used = Math.max(0, Math.min(allowed, usedFromOrder));
    remaining = Math.max(0, allowed - used);
    source = 'order_used';
  } else {
    used = Math.max(0, Array.isArray(sites) ? sites.length : 0);
    remaining = Math.max(0, allowed - used);
    source = 'sites_count';
  }
  return { allowed, used, remaining, source };
}

function safeOrder(row = null) {
  if (!row) return { hasPackage: false };
  return {
    hasPackage: true, id: row.id || null, plan_key: getPlanKey(row),
    plan_name: row.plan_name || row.package_name || 'Website Package',
    status: row.status || 'active', amount_paid: row.amount_paid || null,
    sites_purchased: row.sites_purchased || null, sites_used: row.sites_used || null,
    sites_remaining: row.sites_remaining || null, created_at: row.created_at || null, updated_at: row.updated_at || null
  };
}

function safeSubscription(row = null) {
  if (!row) return { hasSubscription: false };
  return {
    hasSubscription: true, id: row.id || null, plan_key: row.plan_key || getPlanKey(row),
    plan_name: row.plan_name || row.support_tier || 'Site Management',
    support_tier: row.support_tier || '', status: row.stripe_status || row.status || 'active',
    stripe_status: row.stripe_status || '', public_price: row.public_price || '',
    update_allowance: row.update_allowance || '', updates_allowed: getSubscriptionUpdateAllowance(row),
    current_period_end: row.current_period_end || null, cancel_at_period_end: Boolean(row.cancel_at_period_end || false),
    created_at: row.created_at || null, updated_at: row.updated_at || null
  };
}

function safeSites(rows = []) {
  return (Array.isArray(rows) ? rows : []).slice(0, 20).map(r => ({
    id: r.id || null, order_id: r.order_id || null, email: r.email || '',
    business_name: r.business_name || '', site_name: r.site_name || '',
    domain_name: r.domain_name || '', site_status: r.site_status || r.status || '',
    template_selected: r.template_selected || '', created_at: r.created_at || null, updated_at: r.updated_at || null
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'El panel de miembro no está configurado.' }) };
  }

  const email = normalizeEmail((event.queryStringParameters || {}).email || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Se requiere un correo electrónico válido.' }) };
  }

  try {
    const [userRows, orders, subscriptions, sites] = await Promise.all([
      sbGet('users', email, '&limit=1'),
      sbGet('orders', email),
      sbGet('subscriptions', email),
      sbGet('sites', email)
    ]);

    const user             = userRows[0] || null;
    const latestOrder      = getLatestActive(orders);
    const latestSub        = getLatestActive(subscriptions);
    const buildSummary     = getBuildSummary(latestOrder, sites);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true, email,
        user: {
          email,
          full_name: user?.full_name || latestOrder?.full_name || latestSub?.full_name || '',
          phone: user?.phone || latestOrder?.phone || latestSub?.phone || '',
          status: user?.status || ''
        },
        package:      safeOrder(latestOrder),
        subscription: safeSubscription(latestSub),
        builds:       buildSummary,
        sites:        safeSites(sites),
        counts:       { orders: orders.length, subscriptions: subscriptions.length, sites: sites.length }
      })
    };
  } catch (err) {
    console.error('Portal handler error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo cargar el panel de miembro.' }) };
  }
};
