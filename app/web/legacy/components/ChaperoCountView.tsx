import React, { useMemo, useRef, useState } from 'react';
import { CameraIcon, UploadIcon, LoadingIcon, LayersIcon, InfoIcon, CheckIcon, RulerIcon } from './Icons';
import { CvCountResult, NormalizedRect, countMetalSheetsCV, cropImageDataUrl, preprocessMetalImage, resizeImageDataUrl } from '../lib/metalVision';

const MATERIALS = ['ACERO', 'INOX', 'ALUMINIO', 'GALVANIZADO', 'CORTEN'];

interface FinalCountResult {
    finalCount: number;
    estimatedCount: number;
    confidence: CvCountResult['confidence'];
    reasoning: string;
    theoreticalBlockHeightMm: number;
    cvResult: CvCountResult;
}

const INITIAL_CROP: NormalizedRect = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ChaperoCountView: React.FC = () => {
    const [material, setMaterial] = useState('ACERO');
    const [thickness, setThickness] = useState<string>('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<FinalCountResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualFinalCount, setManualFinalCount] = useState<number | null>(null);
    const [savedManual, setSavedManual] = useState(false);

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cropEnabled, setCropEnabled] = useState(false);
    const [cropRect, setCropRect] = useState<NormalizedRect>(INITIAL_CROP);
    const [isDrawingCrop, setIsDrawingCrop] = useState(false);
    const [calibrationMode, setCalibrationMode] = useState(false);
    const [calibrationPointsY, setCalibrationPointsY] = useState<number[]>([]);

    const [analysisImages, setAnalysisImages] = useState<{ cropped: string; processed: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const pointerStart = useRef<{ x: number; y: number } | null>(null);

    const calibrationDelta = useMemo(() => {
        if (calibrationPointsY.length !== 2) return null;
        return Math.abs(calibrationPointsY[0] - calibrationPointsY[1]);
    }, [calibrationPointsY]);

    const startCamera = async () => {
        setError(null);
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error(err);
            setError('No se pudo acceder a la camara.');
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const resetForNewImage = () => {
        setResult(null);
        setManualFinalCount(null);
        setSavedManual(false);
        setCropRect(INITIAL_CROP);
        setCalibrationPointsY([]);
        setAnalysisImages(null);
        setError(null);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(videoRef.current, 0, 0);
        const image = canvas.toDataURL('image/jpeg', 0.92);
        stopCamera();
        setImagePreview(image);
        resetForNewImage();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const value = e.target?.result as string;
            setImagePreview(value);
            resetForNewImage();
        };
        reader.readAsDataURL(file);
    };

    const getRelativePoint = (clientX: number, clientY: number) => {
        const box = previewRef.current?.getBoundingClientRect();
        if (!box) return null;

        const x = clamp((clientX - box.left) / box.width, 0, 1);
        const y = clamp((clientY - box.top) / box.height, 0, 1);
        return { x, y };
    };

    const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (calibrationMode) {
            const p = getRelativePoint(event.clientX, event.clientY);
            if (!p) return;
            setCalibrationPointsY(prev => {
                if (prev.length >= 2) return [p.y];
                return [...prev, p.y];
            });
            return;
        }

        if (!cropEnabled) return;

        const p = getRelativePoint(event.clientX, event.clientY);
        if (!p) return;

        pointerStart.current = p;
        setIsDrawingCrop(true);
        setCropRect({ x: p.x, y: p.y, w: 0.001, h: 0.001 });
    };

    const handlePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!cropEnabled || !isDrawingCrop || !pointerStart.current) return;
        const p = getRelativePoint(event.clientX, event.clientY);
        if (!p) return;

        const x1 = Math.min(pointerStart.current.x, p.x);
        const y1 = Math.min(pointerStart.current.y, p.y);
        const x2 = Math.max(pointerStart.current.x, p.x);
        const y2 = Math.max(pointerStart.current.y, p.y);

        setCropRect({
            x: clamp(x1, 0, 1),
            y: clamp(y1, 0, 1),
            w: clamp(x2 - x1, 0.01, 1),
            h: clamp(y2 - y1, 0.01, 1),
        });
    };

    const handlePreviewPointerUp = () => {
        setIsDrawingCrop(false);
        pointerStart.current = null;
    };

    const handleCount = async () => {
        if (!imagePreview || !material || !thickness) {
            setError('Completa material, grosor e imagen para analizar.');
            return;
        }

        const thicknessValue = Number.parseFloat(thickness.replace(',', '.'));
        if (Number.isNaN(thicknessValue) || thicknessValue <= 0) {
            setError('Introduce un grosor valido en mm.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setSavedManual(false);

        try {
            const resized = await resizeImageDataUrl(imagePreview, 1280);
            const cropped = cropEnabled ? await cropImageDataUrl(resized, cropRect) : resized;
            const processed = await preprocessMetalImage(cropped);
            const cvResult = await countMetalSheetsCV(processed);

            const finalResult: FinalCountResult = {
                estimatedCount: cvResult.estimatedCount,
                finalCount: cvResult.estimatedCount,
                confidence: cvResult.confidence,
                reasoning: cvResult.reasoning,
                theoreticalBlockHeightMm: cvResult.estimatedCount * thicknessValue,
                cvResult,
            };

            setAnalysisImages({ cropped, processed });
            setResult(finalResult);
            setManualFinalCount(cvResult.estimatedCount);
        } catch (err: any) {
            setError(err?.message || 'No se pudo completar el conteo.');
        } finally {
            setLoading(false);
        }
    };

    const saveManualCount = () => {
        if (!result || manualFinalCount === null) return;
        const thicknessValue = Number.parseFloat(thickness.replace(',', '.'));
        const fallbackThickness = Number.isFinite(thicknessValue) ? thicknessValue : 1;

        setResult(prev => prev ? {
            ...prev,
            finalCount: manualFinalCount,
            estimatedCount: manualFinalCount,
            theoreticalBlockHeightMm: manualFinalCount * fallbackThickness,
        } : prev);

        setSavedManual(true);
    };

    const resetAll = () => {
        stopCamera();
        setImagePreview(null);
        setResult(null);
        setManualFinalCount(null);
        setSavedManual(false);
        setError(null);
        setCropRect(INITIAL_CROP);
        setCalibrationPointsY([]);
        setAnalysisImages(null);
    };

    return (
        <div className="max-w-3xl mx-auto pb-24">
            <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Chapero CV</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Conteo por visión computacional con recorte, preprocesado y ajuste final.</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">1) Perfil lateral limpio y camara paralela.</div>
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">2) Luz uniforme, sin reflejos fuertes.</div>
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">3) Recorta solo el canto del bloque de chapas.</div>
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">4) Si dudas: ajusta +/- y guarda conteo final.</div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Material</label>
                            <select
                                value={material}
                                onChange={e => setMaterial(e.target.value)}
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-transparent focus:border-cyan-500 outline-none font-bold text-slate-800 dark:text-white"
                            >
                                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Grosor (mm)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                placeholder="Ej: 1.5"
                                value={thickness}
                                onChange={e => setThickness(e.target.value)}
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-transparent focus:border-cyan-500 outline-none font-bold text-slate-800 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setCropEnabled(prev => !prev)}
                            className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-bold border ${cropEnabled ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        >
                            {cropEnabled ? 'Recorte activo' : 'Activar recorte'}
                        </button>
                        <button
                            onClick={() => setCalibrationMode(prev => !prev)}
                            className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-bold border ${calibrationMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        >
                            <RulerIcon className="h-4 w-4 inline mr-1" />
                            Modo calibracion (2 puntos)
                        </button>
                        <button
                            onClick={() => {
                                setCropRect(INITIAL_CROP);
                                setCalibrationPointsY([]);
                            }}
                            className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-bold border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        >
                            Reset marcas
                        </button>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                        <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {calibrationMode
                            ? 'Toca dos puntos verticales (arriba/abajo del bloque) para ayudar a validar escala.'
                            : 'Con recorte activo, arrastra sobre la foto para delimitar solo el canto de chapas.'}
                    </div>
                </div>

                <div className="relative bg-slate-50 dark:bg-black/30 p-4 min-h-[320px] flex items-center justify-center">
                    {isCameraActive ? (
                        <div className="relative w-full max-w-2xl rounded-xl overflow-hidden shadow-lg">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-72 object-cover" />
                            <div className="absolute inset-0 pointer-events-none border-2 border-cyan-400/70 rounded-xl" />
                            <button
                                onClick={capturePhoto}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-lg active:scale-95 transition-transform"
                            >
                                <div className="h-14 w-14 rounded-full border-4 border-cyan-500 bg-white" />
                            </button>
                            <button
                                onClick={stopCamera}
                                className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-full bg-black/55 text-white"
                            >
                                X
                            </button>
                        </div>
                    ) : imagePreview ? (
                        <div
                            ref={previewRef}
                            className="relative w-full max-w-2xl rounded-xl overflow-hidden shadow-md select-none"
                            onPointerDown={handlePreviewPointerDown}
                            onPointerMove={handlePreviewPointerMove}
                            onPointerUp={handlePreviewPointerUp}
                            onPointerLeave={handlePreviewPointerUp}
                        >
                            <img src={imagePreview} alt="Captura chapero" className="w-full h-72 md:h-80 object-cover" />

                            {cropEnabled && (
                                <>
                                    <div className="absolute inset-0 bg-black/35" />
                                    <div
                                        className="absolute border-2 border-cyan-400 bg-cyan-400/10"
                                        style={{
                                            left: `${cropRect.x * 100}%`,
                                            top: `${cropRect.y * 100}%`,
                                            width: `${cropRect.w * 100}%`,
                                            height: `${cropRect.h * 100}%`,
                                        }}
                                    />
                                </>
                            )}

                            {calibrationPointsY.map((y, idx) => (
                                <div
                                    key={`${y}-${idx}`}
                                    className="absolute left-0 right-0 border-t-2 border-yellow-400"
                                    style={{ top: `${y * 100}%` }}
                                >
                                    <span className="absolute right-2 -top-3 px-1.5 py-0.5 bg-yellow-400 text-black text-[10px] font-bold rounded">P{idx + 1}</span>
                                </div>
                            ))}

                            <button
                                onClick={resetAll}
                                className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-full bg-black/60 text-white"
                            >
                                X
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <button
                                onClick={startCamera}
                                className="flex flex-col items-center justify-center h-32 w-32 bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 rounded-2xl border-2 border-dashed border-cyan-300 dark:border-cyan-700 hover:scale-105 transition-transform"
                            >
                                <CameraIcon className="h-10 w-10 mb-2" />
                                <span className="text-xs font-bold uppercase">Camara</span>
                            </button>
                            <span className="text-slate-400 text-xs font-bold uppercase">o</span>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="min-h-[44px] px-6 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-sm flex items-center gap-2"
                            >
                                <UploadIcon className="h-4 w-4" /> Subir foto
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                    )}
                </div>

                <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-800">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-bold text-center">
                            {error}
                        </div>
                    )}

                    {!loading && !result && (
                        <button
                            onClick={handleCount}
                            disabled={!imagePreview || !thickness}
                            className="w-full min-h-[48px] py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <LayersIcon className="h-5 w-5" /> Analizar con CV
                        </button>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <LoadingIcon className="h-8 w-8 text-cyan-500 animate-spin mb-2" />
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Procesando: recorte y preprocesado CV...</p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4">
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">Conteo final operativo</div>
                                <div className="text-5xl font-black text-slate-900 dark:text-white leading-none">{result.finalCount}</div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-1 rounded bg-cyan-100 text-cyan-800 font-bold">CV: {result.cvResult.estimatedCount}</span>
                                    <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">Confianza: {result.confidence.toUpperCase()}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {analysisImages?.cropped && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-1 uppercase">Recorte usado</p>
                                        <img src={analysisImages.cropped} alt="Recorte" className="w-full h-28 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                    </div>
                                )}
                                {analysisImages?.processed && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-1 uppercase">Version procesada</p>
                                        <img src={analysisImages.processed} alt="Procesada" className="w-full h-28 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                    </div>
                                )}
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border-l-4 border-indigo-500">
                                <h3 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2">Ajuste manual rapido</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setManualFinalCount(prev => Math.max(1, (prev ?? result.finalCount) - 1))}
                                        className="h-11 w-11 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 font-black text-lg"
                                    >
                                        -
                                    </button>
                                    <div className="flex-1 h-11 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center font-black text-xl">
                                        {manualFinalCount ?? result.finalCount}
                                    </div>
                                    <button
                                        onClick={() => setManualFinalCount(prev => (prev ?? result.finalCount) + 1)}
                                        className="h-11 w-11 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 font-black text-lg"
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    onClick={saveManualCount}
                                    className="mt-3 w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
                                >
                                    <CheckIcon className="h-5 w-5" /> Guardar conteo final
                                </button>
                                {savedManual && (
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-2">Conteo final guardado para operacion.</p>
                                )}
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                <p><strong>CV:</strong> {result.cvResult.reasoning}</p>
                            </div>

                            <button
                                onClick={resetAll}
                                className="w-full min-h-[44px] py-3 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl"
                            >
                                Nuevo analisis
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChaperoCountView;
