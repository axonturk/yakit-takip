import { t } from '../i18n';

// Public project URL and anon key: safe to ship; access is enforced by row-level security.
export const SUPABASE_URL = 'https://pmymlyerxwxonmknrxgs.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBteW1seWVyeHd4b25ta25yeGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTAyNDQsImV4cCI6MjEwNjk2NjI0NH0.liuuVjiNfaQ4icjl782_OwOx_XvzVEMnvDWb128rDr0';

// The client library is loaded only when the cloud is used, keeping first load small.
let clientPromise = null;
export function getClient() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    );
  }
  return clientPromise;
}

// True when this device was signed in before, or is returning from an e-mail link.
export function cloudWasUsed() {
  try {
    if (localStorage.getItem('sb-pmymlyerxwxonmknrxgs-auth-token')) return true;
  } catch {
    // storage blocked
  }
  return /access_token=|[?&]code=|token_hash=/.test(window.location.href);
}

const META_KEY = 'hisapo_cloud_v1';
const PAGE = 1000;

// Per-device sync bookkeeping: chosen workspace, last pull time, and hashes of synced records.
export function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch {
    return {};
  }
}
export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // storage full or blocked: sync will resend next time
  }
}

const fail = (error) => {
  if (error) throw new Error(error.message || String(error));
};

export async function sendCode(email) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  fail(error);
}

export async function verifyCode(email, token) {
  const supabase = await getClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  fail(error);
}

export async function signOut() {
  const supabase = await getClient();
  await supabase.auth.signOut();
}

export async function myWorkspaces() {
  const supabase = await getClient();
  const { data, error } = await supabase.from('workspaces').select('id, name, invite_code, driver_code, created_at').order('created_at');
  fail(error);
  return data;
}

export async function workspaceMembers(workspaceId) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, email, role, plate, monthly_limit, joined_at')
    .eq('workspace_id', workspaceId)
    .order('joined_at');
  fail(error);
  return data;
}

// This user's role in the workspace with the workspace's current name and codes; null if no longer a member.
export async function myMembership(workspaceId) {
  const supabase = await getClient();
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, plate, monthly_limit, workspaces(name, invite_code, driver_code)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', uid)
    .maybeSingle();
  // Before the newer schema.sql is run the extra columns are missing: keep syncing with the role alone
  if (error && /column|does not exist|relationship|schema cache/i.test(error.message)) {
    const basic = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', uid)
      .maybeSingle();
    fail(basic.error);
    return basic.data && { ...basic.data, plate: null, monthly_limit: null, outdated: true };
  }
  fail(error);
  return data;
}

export async function updateMember(workspaceId, userId, { role, plate, monthlyLimit }) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('update_member', {
    ws: workspaceId,
    member: userId,
    new_role: role,
    new_plate: plate || '',
    new_limit: monthlyLimit === '' || monthlyLimit === null || monthlyLimit === undefined ? null : Number(monthlyLimit)
  });
  fail(error);
}

export async function removeMember(workspaceId, userId) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('remove_member', { ws: workspaceId, member: userId });
  fail(error);
}

// Leave a workspace this user just joined (used when a driver declines to drop local records).
export async function leaveWorkspace(workspaceId) {
  const supabase = await getClient();
  const { data: s } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', s.session?.user?.id);
  fail(error);
}

export async function createWorkspace(name) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('create_workspace', { ws_name: name });
  fail(error);
  return data;
}

export async function joinWorkspace(code) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('join_workspace', { code });
  if (error && /invalid invite code/i.test(error.message)) throw new Error(t('Davet kodu bulunamadı.'));
  fail(error);
  return data;
}

export async function renameWorkspace(id, name) {
  const supabase = await getClient();
  const { error } = await supabase.from('workspaces').update({ name }).eq('id', id);
  fail(error);
}

// Rows changed since `since` (ISO), oldest first.
export async function pullRecords(workspaceId, since) {
  const supabase = await getClient();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('records')
      .select('kind, id, data, deleted, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at')
      .range(from, from + PAGE - 1);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    fail(error);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

export async function pushRecords(workspaceId, upserts, deletes) {
  const supabase = await getClient();
  const rows = [
    ...upserts.map((r) => ({ workspace_id: workspaceId, kind: r.kind, id: r.id, data: r.data, deleted: false })),
    ...deletes.map((r) => ({ workspace_id: workspaceId, kind: r.kind, id: r.id, data: null, deleted: true }))
  ];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('records').upsert(rows.slice(i, i + 500), {
      onConflict: 'workspace_id,kind,id'
    });
    fail(error);
  }
}

// Latest changes in the workspace, or the history of one record, newest first.
export async function changeLog(workspaceId, { kind, id, limit = 50 } = {}) {
  const supabase = await getClient();
  let q = supabase
    .from('record_log')
    .select('log_id, kind, id, action, data, previous, changed_at, changed_by_email')
    .eq('workspace_id', workspaceId)
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (kind) q = q.eq('kind', kind).eq('id', id);
  const { data, error } = await q;
  if (error && /record_log/.test(error.message)) throw new Error(t('Değişiklik geçmişi için Supabase kurulumu güncellenmeli.'));
  fail(error);
  return data;
}

// Receipt photos: private bucket, one folder per workspace. Photos never change, so an existing copy counts as done.
const BUCKET = 'receipts';
const photoPath = (workspaceId, photoId) => `${workspaceId}/${photoId}.jpg`;

export async function uploadPhoto(workspaceId, photoId, blob) {
  const supabase = await getClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath(workspaceId, photoId), blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) fail(error);
}

// The photo as a Blob, or null if nobody uploaded it.
export async function downloadPhoto(workspaceId, photoId) {
  const supabase = await getClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(photoPath(workspaceId, photoId));
  if (error) {
    if (/not.?found|404|400/i.test(`${error.message} ${error.statusCode || ''}`)) return null;
    fail(error);
  }
  return data;
}
