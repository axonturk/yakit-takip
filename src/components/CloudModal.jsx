import React, { useEffect, useState } from 'react';
import { Cloud, X, RefreshCw, Copy, Share2, LogOut, Users } from 'lucide-react';
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
  removeMember
} from '../services/cloud';
import { formatTRDate, formatTL } from '../services/storage';
import { memberMonthSpend, ROLE_LABEL } from '../services/team';
import ChangeLog, { ChangeLogTitle } from './ChangeLog';

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
              <h2 className="text-sm font-bold text-white">Bulut Yedek ve Ortak Defter</h2>
              <p className="text-[10px] text-slate-400">Kayıtlar buluta yedeklenir, ekibinle paylaşılır</p>
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
        E-posta adresinle giriş yap. Şifre yok: adresine bir giriş bağlantısı gönderiyoruz.
      </p>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="ornek@firma.com"
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
          {busy ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
        </button>
      ) : (
        <>
          <p className="text-[11px] text-emerald-300">
            E-posta gönderildi. İçindeki bağlantıya bu telefonda dokun. E-postada 6 haneli kod varsa aşağıya da yazabilirsin.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 haneli kod"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className={`${inputClass} tracking-[0.4em] text-center font-bold`}
          />
          <button
            className={primary}
            disabled={busy || code.length < 6}
            onClick={() => run(() => verifyCode(email.trim(), code))}
          >
            {busy ? 'Kontrol ediliyor…' : 'Giriş yap'}
          </button>
          <button className="text-[11px] text-slate-400 hover:text-slate-200" onClick={() => setSent(false)}>
            Kodu tekrar gönder
          </button>
        </>
      )}
      <ErrorLine text={err} />
    </div>
  );
}

function PickWorkspace({ cloud, localCount }) {
  const [list, setList] = useState(null);
  const [name, setName] = useState('İşletmem');
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
        `"${ws.name}" defterine şoför olarak katılıyorsun. Bu telefondaki ${localCount} kayıt deftere eklenmez ve telefondan kaldırılır. Devam edilsin mi?`
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
      <p className="text-[11px] text-slate-400">Giriş yapıldı: {cloud.email}</p>
      {cloud.removedFrom && (
        <p className="text-[11px] text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg p-2">
          "{cloud.removedFrom}" defterinden çıkarıldın. Kayıtlar bu telefonda duruyor.
        </p>
      )}
      {localCount > 0 && (
        <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          Bu telefondaki {localCount} kayıt seçtiğin deftere eklenecek, hiçbir şey silinmez. (Şoför koduyla katılırsan eklenmez.)
        </p>
      )}

      {list?.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-300">Defterlerin</div>
          {list.map((ws) => (
            <button key={ws.id} className={secondary} disabled={busy} onClick={() => run(async () => ws)}>
              {ws.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300">Yeni ortak defter oluştur</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="İşletme adı" className={inputClass} />
        <button className={primary} disabled={busy || !name.trim()} onClick={() => run(() => createWorkspace(name.trim()))}>
          Oluştur ve yedeklemeye başla
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300">Ya da davet koduyla katıl</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Örn: 7F3K9QAB"
          className={`${inputClass} uppercase tracking-widest`}
        />
        <button className={secondary} disabled={busy || code.trim().length < 6} onClick={() => run(() => joinWorkspace(code), true)}>
          Katıl
        </button>
      </div>

      <ErrorLine text={err} />
      <button
        className="w-full text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1"
        onClick={signOut}
      >
        <LogOut className="w-3 h-3" /> Çıkış yap
      </button>
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
          {cloud.email} · {ROLE_LABEL[cloud.role] || 'Yönetici'}
        </div>
        <div className={`text-[11px] font-semibold ${tone}`}>
          {isSample ? 'Örnek verilerle eşitleme kapalı' : STATUS_TEXT[cloud.status] || ''}
          {cloud.lastSyncAt && cloud.status !== 'syncing' ? ` · son: ${formatTRDate(cloud.lastSyncAt)}` : ''}
        </div>
        {cloud.status === 'error' && cloud.error && <div className="text-[10px] text-red-300">{cloud.error}</div>}
      </div>

      <button className={secondary} onClick={cloud.syncNow} disabled={cloud.status === 'syncing' || isSample}>
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${cloud.status === 'syncing' ? 'animate-spin' : ''}`} /> Şimdi eşitle
        </span>
      </button>

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> Ekip ({members.length})
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
          <p className="text-[10px] text-slate-500">Rolünü, plakasını ya da aylık limitini değiştirmek için kişiye dokun.</p>
        )}
      </div>

      {canInvite && (
        <div className="space-y-3">
          <InviteCode
            title="Şoför davet kodu"
            hint="Şoför sadece harcama girer, kendi girdiğini düzeltebilir."
            code={cloud.driverCode}
            role="şoför"
            cloud={cloud}
          />
          <InviteCode
            title="Yönetici davet kodu"
            hint="Yönetici her şeyi görür ve girer: istasyon, bakiye, düzeltme."
            code={cloud.inviteCode}
            role="yönetici"
            cloud={cloud}
          />
        </div>
      )}

      <div className="space-y-2">
        {showLog ? (
          <>
            <ChangeLogTitle>Son değişiklikler</ChangeLogTitle>
            <ChangeLog workspaceId={cloud.workspaceId} />
          </>
        ) : (
          <button className={secondary} onClick={() => setShowLog(true)}>
            Değişiklik geçmişi (kim, ne zaman, ne)
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-500">
        Fiş fotoğrafları şimdilik buluta gitmez, sadece çekildiği telefonda kalır.
      </p>

      <button
        className="w-full text-[11px] text-slate-400 hover:text-red-300 flex items-center justify-center gap-1"
        onClick={async () => {
          if (!window.confirm('Bu cihaz buluttan çıkarılsın mı? Telefondaki kayıtlar silinmez.')) return;
          cloud.leave();
          await signOut();
        }}
      >
        <LogOut className="w-3 h-3" /> Çıkış yap
      </button>
    </div>
  );
}

function MemberRow({ member, spend, editable, onEdit }) {
  const limit = member.monthly_limit === null ? null : Number(member.monthly_limit);
  const over = limit !== null && spend > limit;
  const body = (
    <>
      <div className="flex justify-between gap-2">
        <span className="truncate text-slate-200">{member.email || 'Kullanıcı'}</span>
        <span className="text-slate-500 shrink-0">{ROLE_LABEL[member.role]}</span>
      </div>
      {(member.role === 'driver' || member.plate) && (
        <div className="flex justify-between gap-2 text-[10px] text-slate-400">
          <span>{member.plate ? <span className="font-mono">{member.plate}</span> : 'Plaka yok'}</span>
          <span className={over ? 'text-red-300 font-semibold' : ''}>
            Bu ay {formatTL(spend)}
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
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <input
        value={plate}
        onChange={(e) => setPlate(e.target.value.toUpperCase())}
        placeholder="Plaka (isteğe bağlı)"
        className={`${inputClass} font-mono`}
      />
      <input
        value={limit}
        onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        placeholder="Aylık harcama limiti TL (isteğe bağlı)"
        className={inputClass}
      />
      <ErrorLine text={err} />
      <div className="flex gap-2">
        <button className={primary} disabled={busy} onClick={() => run(() => updateMember(workspaceId, member.user_id, { role, plate, monthlyLimit: limit }))}>
          Kaydet
        </button>
        <button className={secondary} disabled={busy} onClick={onDone}>
          Vazgeç
        </button>
      </div>
      <button
        disabled={busy}
        className="w-full text-[11px] text-red-300 hover:text-red-200"
        onClick={() => {
          if (!window.confirm(`${member.email} ekipten çıkarılsın mı? Girdiği kayıtlar defterde kalır.`)) return;
          run(() => removeMember(workspaceId, member.user_id));
        }}
      >
        Ekipten çıkar
      </button>
    </div>
  );
}

function InviteCode({ title, hint, code, role, cloud }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const inviteText =
    `Hisapo'da "${cloud.workspaceName}" yakıt defterine ${role} olarak katıl.\n` +
    `1) ${window.location.origin + window.location.pathname} adresini aç\n` +
    `2) Bulut düğmesine bas, e-postanla giriş yap\n` +
    `3) Davet kodu: ${code}`;
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
        <button onClick={copy} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200" title="Kodu kopyala">
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank', 'noopener')}
          className="p-2.5 bg-emerald-600 rounded-xl text-white"
          title="WhatsApp ile davet et"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] text-slate-500">{copied ? 'Kopyalandı. ' : ''}{hint}</p>
    </div>
  );
}
