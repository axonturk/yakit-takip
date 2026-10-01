import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, Upload, Sparkles, Clock } from 'lucide-react';
import { runOcr } from '../services/ocr';
import { formatTL } from '../services/storage';
import StationLogo from './StationLogo';

export default function PumpScannerModal({
  isOpen,
  onClose,
  stations,
  onSaveExpense,
  defaultStationId
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form fields
  const [selectedStationId, setSelectedStationId] = useState(defaultStationId || stations[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [liters, setLiters] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [datetime, setDatetime] = useState('');
  const [note, setNote] = useState('');
  const [verifiedStatus, setVerifiedStatus] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // Default to current local datetime & pre-select defaultStationId
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setDatetime(now.toISOString().slice(0, 16));

      if (defaultStationId && stations.some(s => s.id === defaultStationId)) {
        setSelectedStationId(defaultStationId);
      } else if (stations.length > 0 && (!selectedStationId || !stations.some(s => s.id === selectedStationId))) {
        setSelectedStationId(stations[0].id);
      }
    } else {
      stopCamera();
    }
  }, [isOpen, defaultStationId, stations]);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera access issue:', err);
      setErrorMsg('Kamera erişimi sağlanamadı. Fotoğraf yükleyebilir veya örnek test ekranlarını kullanabilirsiniz.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Capture frame from active camera
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    await processImage(canvas);
  };

  // Process uploaded image file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          processImage(canvas);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Run OCR and fill form
  const processImage = async (canvasElement) => {
    setIsProcessing(true);
    setOcrProgress(10);
    setErrorMsg(null);
    try {
      const result = await runOcr(canvasElement, 'pump', (p) => setOcrProgress(p));
      console.log('Processed result:', result);

      if (result.total) {
        setAmount(result.total.toString());
      }
      if (result.liters) {
        setLiters(result.liters.toString());
      }
      if (result.unitPrice) {
        setUnitPrice(result.unitPrice.toString());
      }

      setVerifiedStatus({
        verified: result.verified,
        confidence: result.confidence,
        note: result.note || 'Değerler ayrıştırıldı'
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('Görüntü işlenirken bir hata oluştu. Lütfen değerleri manuel olarak kontrol edin.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Realistic sample simulation (for fast desktop & mobile testing)
  const loadPresetSample = (type) => {
    stopCamera();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    // Draw pump display graphic
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1e293b';
    ctx.roundRect(20, 20, 560, 320, 16);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.fillRect(40, 40, 520, 280);

    ctx.font = 'bold 36px monospace';

    if (type === 1) {
      // 1450 TL, 32.95 L, 44.00 TL/L
      ctx.fillStyle = '#10b981';
      ctx.fillText('TUTAR (TL) : 1450.00', 60, 110);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('LITRE (L)  : 32.95', 60, 190);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('FIYAT(TL/L): 44.00', 60, 270);

      setAmount('1450');
      setLiters('32.95');
      setUnitPrice('44.00');
      setVerifiedStatus({
        verified: true,
        confidence: 'high',
        note: 'Matematiksel Formül Doğrulandı: 32.95 L × 44.00 TL/L = 1450 TL ✓'
      });
    } else {
      // 880 TL, 20.00 L, 44.00 TL/L
      ctx.fillStyle = '#10b981';
      ctx.fillText('TUTAR (TL) : 880.00', 60, 110);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('LITRE (L)  : 20.00', 60, 190);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('FIYAT(TL/L): 44.00', 60, 270);

      setAmount('880');
      setLiters('20.00');
      setUnitPrice('44.00');
      setVerifiedStatus({
        verified: true,
        confidence: 'high',
        note: 'Matematiksel Formül Doğrulandı: 20.00 L × 44.00 TL/L = 880 TL ✓'
      });
    }
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Lütfen geçerli bir Toplam Tutar girin!');
      return;
    }

    onSaveExpense({
      stationId: selectedStationId,
      amount: parsedAmount,
      liters: liters ? parseFloat(liters) : null,
      unitPrice: unitPrice ? parseFloat(unitPrice) : null,
      date: datetime,
      note: note || (verifiedStatus?.verified ? 'Pompa ekranından tarandı' : 'Manuel/Kamera girişi')
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col p-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Pompa Ekranı Tarayıcı</h2>
              <p className="text-[10px] text-slate-400">Kamera ile Tutar, Litre ve Fiyat Okuma</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Canvas / Video area */}
        <div className="my-3">
          <div className="relative aspect-[16/10] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
            )}

            {/* Scanning viewfinder overlay when camera is on */}
            {cameraActive && (
              <div className="absolute inset-3 border-2 border-emerald-400/60 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between text-[10px] text-emerald-400 font-mono bg-black/50 px-2 py-0.5 rounded">
                  <span>POMPA EKRANI ODAĞI</span>
                  <span>CANLI</span>
                </div>
                <div className="text-[10px] text-emerald-300 font-mono text-center bg-black/60 py-1 rounded">
                  Ekranı kutunun içine hizalayın
                </div>
              </div>
            )}

            {/* OCR Progress Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <div className="text-xs font-bold text-white">Sayılar Okunuyor...</div>
                <div className="text-[11px] text-slate-400 mt-1">Litre × Fiyat = Tutar formülü kontrol ediliyor</div>
                <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <span className="text-[10px] text-emerald-400 font-mono mt-1">%{ocrProgress}</span>
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="flex gap-2 mt-2">
            {!cameraActive ? (
              <button
                onClick={startCamera}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Camera className="w-4 h-4" />
                <span>Kamerayı Başlat</span>
              </button>
            ) : (
              <button
                onClick={captureFrame}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Fotoğrafı Çek ve Oku</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Upload className="w-4 h-4" />
              <span>Görsel Yükle</span>
            </button>
          </div>

          {/* Quick Preset Buttons for Instant Demo */}
          <div className="mt-2 p-2 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">Test Örnekleri:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => loadPresetSample(1)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 font-medium rounded-lg border border-emerald-500/30 transition"
              >
                Örnek 1 (₺1.450)
              </button>
              <button
                onClick={() => loadPresetSample(2)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-400 font-medium rounded-lg border border-amber-500/30 transition"
              >
                Örnek 2 (₺880)
              </button>
            </div>
          </div>
        </div>

        {/* Verification Status Badge */}
        {verifiedStatus && (
          <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 mb-3 ${
            verifiedStatus.verified
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
          }`}>
            {verifiedStatus.verified ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span className="text-[11px] font-medium leading-tight">{verifiedStatus.note}</span>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Confirmation Form */}
        <div className="space-y-3 bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400 font-medium">Hangi İstasyon?</label>
              {defaultStationId && selectedStationId === defaultStationId && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Seçili istasyon açıldı (Değiştirebilirsiniz)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <StationLogo
                name={stations.find(s => s.id === selectedStationId)?.name}
                brand={stations.find(s => s.id === selectedStationId)?.brand}
                className="w-10 h-10"
              />
              <select
                value={selectedStationId}
                onChange={(e) => setSelectedStationId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {stations.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.brand ? `(${st.brand})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>


          <div>
            <label className="block text-xs font-bold text-amber-400 mb-1">
              Toplam Tutar (TL) * <span className="text-[10px] font-normal text-slate-400">(Zorunlu)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Örn: 1450"
              className="w-full bg-slate-900 border-2 border-amber-500/70 rounded-xl p-3 text-lg font-extrabold text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Litre (Opsiyonel)</label>
              <input
                type="number"
                step="0.01"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                placeholder="Örn: 32.95"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Birim Fiyat (TL/L)</label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Örn: 44.00"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400 font-medium">Tarih & Saat</label>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    setDatetime(now.toISOString().slice(0, 16));
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5"
                >
                  <Clock className="w-3 h-3" />
                  <span>Şu An</span>
                </button>
              </div>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Örn: Pompa 2"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-[0.98] mt-2 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>BAKİYEDEN DÜŞ VE KAYDET</span>
          </button>
        </div>

      </div>
    </div>
  );
}
