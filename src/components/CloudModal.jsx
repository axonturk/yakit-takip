import React, { useEffect, useState } from 'react';
import { Cloud, X, RefreshCw, Copy, Share2, LogOut, Users, Trash2 } from 'lucide-react';
import {
  sendCode,
  verifyCode,
  signOut,
  myWorkspaces,
  myMembership,
  createWorkspace,
  joinWorkspace,
  leaveWorkspace,
  workspaceMembers,
  updateMember,
  removeMember,
  deleteAccount
} from '../services/cloud';
import { formatTRDate, formatTL } from '../services/storage';
import { memberMonthSpend, ROLE_LABEL } from '../services/team';
import ChangeLog, { ChangeLogTitle } from './ChangeLog';
import PushToggle from './PushToggle';
import { disablePush } from '../services/push';
import { t } from '../i18n';

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-400';
const primary =
  'w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50';
const secondary =
  'w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition disabled:opacity-50';

const STATUS_TEXT = {
  idle: 'Bekliyor',
  syncing: 'Eşitleniyor…',
  ok: 'Güncel',
  error: 'Eşitlenemedi',
  offline: 'İnternet yok, bağlanınca eşitlenecek'
};

export default function CloudModal({ isOpen, onClose, cloud, localCount, isSample, transactions = [] }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar p-5 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-300 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t('Bulut Yedek ve Ortak Defter')}</h2>
              <p className="text-[10px] text-slate-400">{t('Kayıtlar buluta yedeklenir, ekibinle paylaşılır')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4">
          {!cloud.session ? (
            <SignIn />
          ) : !cloud.workspaceId ? (
            <PickWorkspace cloud={cloud} localCount={localCount} />
          ) : (
            <Connected cloud={cloud} isSample={isSample} transactions={transactions} />
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorLine({ text }) {
  if (!text) return null;
  return <p className="text-[11px] text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg p-2">{text}</p>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-300">
        {t('E-posta adresinle giriş yap. Şifre yok: adresine bir giriş bağlantısı gönderiyoruz.')}
      </p>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={t('ornek@firma.com')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      {!sent ? (
        <button
          className={primary}
          disabled={busy || !/\S+@\S+\.\S+/.test(email)}
          onClick={() => run(async () => {
            await sendCode(email.trim());
            setSent(true);
          })}
        >
          {busy ? t('Gönderiliyor…') : t('Giriş bağlantısı gönder')}
        </button>
      ) : (
        <>
          <p className="text-[11px] text-emerald-300">
            {t('E-posta gönderildi. İçindeki bağlantıya bu telefonda dokun. E-postada 6 haneli kod varsa aşağıya da yazabilirsin.')}
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('6 haneli kod')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className={`${inputClass} tracking-[0.4em] text-center font-bold`}
          />
          <button
            className={primary}
            disabled={busy || code.length < 6}
            onClick={() => run(() => verifyCode(email.trim(), code))}
          >
            {busy ? t('Kontrol ediliyor…') : t('Giriş yap')}
          </button>
          <button className="text-[11px] text-slate-400 hover:text-slate-200" onClick={() => setSent(false)}>
            {t('Kodu tekrar gönder')}
          </button>
        </>
      )}
      <ErrorLine text={err} />
    </div>
  );
}

function PickWorkspace({ cloud, localCount }) {
  const [list, setList] = useState(null);
  const [name, setName] = useState(() => t('İşletmem'));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    myWorkspaces().then(setList, (e) => {
      setErr(e.message);
      setList([]);
    });
  }, []);

  // Open a workspace with this user's role. A driver does not bring this phone's records along.
  const open = async (ws, justJoined) => {
    const mine = await myMembership(ws.id);
    const role = mine?.role || 'member';
    if (role === 'driver' && localCount > 0) {
      const ok = window.confirm(
        t('"{name}" defterine şoför olarak katılıyorsun. Bu telefondaki {n} kayıt deftere eklenmez ve telefondan kaldırılır. Devam edilsin mi?', {
          name: ws.name,
          n: localCount
        })
      );
      if (!ok) {
        if (justJoined) await leaveWorkspace(ws.id);
        return;
      }
    }
    cloud.chooseWorkspace(ws, role);
  };

  const run = async (fn, justJoined = false) => {
    setBusy(true);
    setErr(null);
    try {
      await open(await fn(), justJoined);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-400">{t('Giriş yapıldı: {email}', { email: cloud.email })}</p>
      {cloud.removedFrom && (
        <p className="text-[11px] text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg p-2">
          {t('"{name}" defterinden çıkarıldın. Kayıtlar bu telefonda duruyor.', { name: cloud.removedFrom })}
        </p>
      )}
      {localCount > 0 && (
        <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          {t('Bu telefondaki {n} kayıt seçtiğin deftere eklenecek, hiçbir şey silinmez. (Şoför koduyla katılırsan eklenmez.)', { n: localCount })}
        </p>
      )}

      {list?.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-300">{t('Defterlerin')}</div>
          {list.map((ws) => (
            <button key={ws.id} className={secondary} disabled={busy} onClick={() => run(async () => ws)}>
              {ws.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300">{t('Yeni ortak defter oluştur')}</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('İşletme adı')} className={inputClass} />
        <button className={primary} disabled={busy || !name.trim()} onClick={() => run(() => createWorkspace(name.trim()))}>
          {t('Oluştur ve yedeklemeye başla')}
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300">{t('Ya da davet koduyla katıl')}</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('Örn: 7F3K9QAB')}
          className={`${inputClass} uppercase tracking-widest`}
        />
        <button className={secondary} disabled={busy || code.trim().length < 6} onClick={() => run(() => joinWorkspace(code), true)}>
          {t('Katıl')}
        </button>
      </div>

      <ErrorLine text={err} />
      <button
        className="w-full text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1"
        onClick={signOut}
      >
        <LogOut className="w-3 h-3" /> {t('Çıkış yap')}
      </button>
      <DeleteAccount />
    </div>
  );
}

function Connected({ cloud, isSample, transactions }) {
  const [members, setMembers] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState(null);
  const canInvite = cloud.role !== 'driver';
  const isOwner = cloud.role === 'owner';

  const reload = React.useCallback(
    () => workspaceMembers(cloud.workspaceId).then(setMembers, () => setMembers([])),
    [cloud.workspaceId]
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const tone =
    cloud.status === 'ok' ? 'text-emerald-300' : cloud.status === 'error' ? 'text-red-300' : 'text-slate-300';

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-1">
        <div className="text-sm font-bold text-white">{cloud.workspaceName}</div>
        <div className="text-[11px] text-slate-400">
          {cloud.email} · {t(ROLE_LABEL[cloud.role] || 'Yönetici')}
        </div>
        <div className={`text-[11px] font-semibold ${tone}`}>
          {isSample ? t('Örnek verilerle eşitleme kapalı') : STATUS_TEXT[cloud.status] ? t(STATUS_TEXT[cloud.status]) : ''}
          {cloud.lastSyncAt && cloud.status !== 'syncing' ? ` · ${t('son: {date}', { date: formatTRDate(cloud.lastSyncAt) })}` : ''}
        </div>
        {cloud.status === 'error' && cloud.error && <div className="text-[10px] text-red-300">{cloud.error}</div>}
      </div>

      {cloud.setupOutdated && (
        <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          {t('Supabase kurulumu eski: şoför kodu, plaka ve limit için güncel schema.sql dosyası Supabase SQL Editor\'de bir kez daha çalıştırılmalı. Kayıtların eşitlenmeye devam ediyor.')}
        </p>
      )}

      <button className={secondary} onClick={cloud.syncNow} disabled={cloud.status === 'syncing' || isSample}>
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${cloud.status === 'syncing' ? 'animate-spin' : ''}`} /> {t('Şimdi eşitle')}
        </span>
      </button>

      {canInvite && !isSample && <PushToggle workspaceId={cloud.workspaceId} />}

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {t('Ekip ({n})', { n: members.length })}
        </div>
        {members.map((m) =>
          editing === m.user_id ? (
            <MemberEditor
              key={m.user_id}
              member={m}
              workspaceId={cloud.workspaceId}
              onDone={() => {
                setEditing(null);
                reload();
                cloud.syncNow();
              }}
            />
          ) : (
            <MemberRow
              key={m.user_id}
              member={m}
              spend={memberMonthSpend(transactions, m.user_id)}
              editable={isOwner && m.role !== 'owner'}
              onEdit={() => setEditing(m.user_id)}
            />
          )
        )}
        {isOwner && members.length > 1 && (
          <p className="text-[10px] text-slate-500">{t('Rolünü, plakasını ya da aylık limitini değiştirmek için kişiye dokun.')}</p>
        )}
      </div>

      {canInvite && (
        <div className="space-y-3">
          <InviteCode
            title={t('Şoför davet kodu')}
            hint={t('Şoför sadece harcama girer, kendi girdiğini düzeltebilir.')}
            code={cloud.driverCode}
            role={t('şoför')}
            cloud={cloud}
          />
          <InviteCode
            title={t('Yönetici davet kodu')}
            hint={t('Yönetici her şeyi görür ve girer: istasyon, bakiye, düzeltme.')}
            code={cloud.inviteCode}
            role={t('yönetici')}
            cloud={cloud}
          />
        </div>
      )}

      <div className="space-y-2">
        {showLog ? (
          <>
            <ChangeLogTitle>{t('Son değişiklikler')}</ChangeLogTitle>
            <ChangeLog workspaceId={cloud.workspaceId} />
          </>
        ) : (
          <button className={secondary} onClick={() => setShowLog(true)}>
            {t('Değişiklik geçmişi (kim, ne zaman, ne)')}
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-500">
        {t('Fiş fotoğrafları da buluta yüklenir; ekipten herkes kayda dokununca fotoğrafı görür.')}
        {cloud.photoError && (
          <span className="block text-amber-300 mt-0.5">{t('Fotoğraflar şu an yüklenemiyor: {error}', { error: cloud.photoError })}</span>
        )}
      </p>

      <button
        className="w-full text-[11px] text-slate-400 hover:text-red-300 flex items-center justify-center gap-1"
        onClick={async () => {
          if (!window.confirm(t('Bu cihaz buluttan çıkarılsın mı? Telefondaki kayıtlar silinmez.'))) return;
          await disablePush().catch(() => {});
          cloud.leave();
          await signOut();
        }}
      >
        <LogOut className="w-3 h-3" /> {t('Çıkış yap')}
      </button>
      <DeleteAccount isOwner={isOwner} onDeleted={() => cloud.leave()} />
    </div>
  );
}

// Google Play asks apps with accounts to offer deletion inside the app
function DeleteAccount({ isOwner, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const word = t('SİL');
  const [before, after] = t('Onaylamak için {word} yaz', { word: '\u0000' }).split('\u0000');
  const confirmed = /^s[iıİI]l$/i.test(typed.trim()) || typed.trim().toLowerCase() === word.toLowerCase();

  if (!open) {
    return (
      <button
        className="w-full text-[10px] text-slate-500 hover:text-red-300 flex items-center justify-center gap-1"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="w-3 h-3" /> {t('Hesabımı sil')}
      </button>
    );
  }
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-red-200">{t('Hesabımı sil')}</div>
      <p className="text-[11px] text-slate-300">
        {isOwner
          ? t('Bulut hesabın silinir. Sahibi olduğun defter, içindeki tüm kayıtlar ve fiş fotoğrafları ekipteki herkes için kalıcı olarak silinir.')
          : isOwner === false
            ? t('Bulut hesabın silinir ve defterden çıkarsın. Girdiğin kayıtlar işletmenin defterinde kalır, e-posta adresin kayıtlardan kaldırılır.')
            : t('Bulut hesabın silinir. Sahibi olduğun defterler tüm kayıtları ve fotoğraflarıyla herkes için silinir; başkasının defterine girdiğin kayıtlar orada kalır, e-posta adresin kaldırılır.')}{' '}
        {t('Bu telefondaki kayıtlar silinmez.')}
      </p>
      <label className="block text-[11px] text-slate-400">
        {before}
        <b className="text-slate-200">{word}</b>
        {after}
      </label>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} />
      <ErrorLine text={err} />
      <div className="grid grid-cols-2 gap-2">
        <button className={secondary} onClick={() => setOpen(false)} disabled={busy}>
          {t('Vazgeç')}
        </button>
        <button
          className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
          disabled={!confirmed || busy}
          onClick={async () => {
            setBusy(true);
            setErr('');
            try {
              await disablePush().catch(() => {});
              await deleteAccount();
              onDeleted?.();
              window.alert(t('Hesabın silindi.'));
            } catch (e) {
              setErr(e?.message || String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? '…' : t('Kalıcı olarak sil')}
        </button>
      </div>
    </div>
  );
}

function MemberRow({ member, spend, editable, onEdit }) {
  const limit = member.monthly_limit === null ? null : Number(member.monthly_limit);
  const over = limit !== null && spend > limit;
  const body = (
    <>
      <div className="flex justify-between gap-2">
        <span className="truncate text-slate-200">{member.email || t('Kullanıcı')}</span>
        <span className="text-slate-500 shrink-0">{ROLE_LABEL[member.role] ? t(ROLE_LABEL[member.role]) : ''}</span>
      </div>
      {(member.role === 'driver' || member.plate) && (
        <div className="flex justify-between gap-2 text-[10px] text-slate-400">
          <span>{member.plate ? <span className="font-mono">{member.plate}</span> : t('Plaka yok')}</span>
          <span className={over ? 'text-red-300 font-semibold' : ''}>
            {t('Bu ay {amount}', { amount: formatTL(spend) })}
            {limit !== null ? ` / ${formatTL(limit)}` : ''}
          </span>
        </div>
      )}
    </>
  );
  return editable ? (
    <button onClick={onEdit} className="w-full text-left text-[11px] bg-slate-800/40 hover:bg-slate-800 border border-slate-800 rounded-lg p-2 space-y-0.5 transition">
      {body}
    </button>
  ) : (
    <div className="text-[11px] p-2 space-y-0.5">{body}</div>
  );
}

function MemberEditor({ member, workspaceId, onDone }) {
  const [role, setRole] = useState(member.role);
  const [plate, setPlate] = useState(member.plate || '');
  const [limit, setLimit] = useState(member.monthly_limit === null ? '' : String(member.monthly_limit));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-800/60 border border-amber-500/40 rounded-xl p-3 space-y-2 text-[11px]">
      <div className="font-semibold text-slate-200 truncate">{member.email}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {['driver', 'member'].map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`py-2 rounded-lg font-semibold border transition ${
              role === r ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {t(ROLE_LABEL[r])}
          </button>
        ))}
      </div>
      <input
        value={plate}
        onChange={(e) => setPlate(e.target.value.toUpperCase())}
        placeholder={t('Plaka (isteğe bağlı)')}
        className={`${inputClass} font-mono`}
      />
      <input
        value={limit}
        onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        placeholder={t('Aylık harcama limiti {cur} (isteğe bağlı)')}
        className={inputClass}
      />
      <ErrorLine text={err} />
      <div className="flex gap-2">
        <button className={primary} disabled={busy} onClick={() => run(() => updateMember(workspaceId, member.user_id, { role, plate, monthlyLimit: limit }))}>
          {t('Kaydet')}
        </button>
        <button className={secondary} disabled={busy} onClick={onDone}>
          {t('Vazgeç')}
        </button>
      </div>
      <button
        disabled={busy}
        className="w-full text-[11px] text-red-300 hover:text-red-200"
        onClick={() => {
          if (!window.confirm(t('{email} ekipten çıkarılsın mı? Girdiği kayıtlar defterde kalır.', { email: member.email }))) return;
          run(() => removeMember(workspaceId, member.user_id));
        }}
      >
        {t('Ekipten çıkar')}
      </button>
    </div>
  );
}

function InviteCode({ title, hint, code, role, cloud }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const inviteText =
    `${t('Hisapo\'da "{name}" yakıt defterine {role} olarak katıl.', { name: cloud.workspaceName, role })}\n` +
    `${t('1) {url} adresini aç', { url: window.location.origin + window.location.pathname })}\n` +
    `${t('2) Bulut düğmesine bas, e-postanla giriş yap')}\n` +
    `${t('3) Davet kodu: {code}', { code })}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; code is visible on screen
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold text-slate-300">{title}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-center font-mono font-black tracking-[0.3em] text-amber-300 bg-slate-800 border border-slate-700 rounded-xl py-2">
          {code}
        </div>
        <button onClick={copy} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200" title={t('Kodu kopyala')}>
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank', 'noopener')}
          className="p-2.5 bg-emerald-600 rounded-xl text-white"
          title={t('WhatsApp ile davet et')}
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] text-slate-500">{copied ? `${t('Kopyalandı.')} ` : ''}{hint}</p>
    </div>
  );
}
