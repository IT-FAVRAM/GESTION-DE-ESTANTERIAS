
import React, { useState, useRef, useEffect } from 'react';
import { CameraIcon, UploadIcon, LoadingIcon, SparklesIcon, LayersIcon, InfoIcon, CheckIcon, RulerIcon, CloseIcon } from './Icons';
import { countMetalSheets, MetalSheetCountResult } from '../lib/gemini';

const MATERIALS = ['ACERO', 'INOX', 'ALUMINIO', 'GALVANIZADO', 'CORTEN'];

const ChaperoCountView: React.FC = () => {
    const [material, setMaterial] = useState('ACERO');
    const [thickness, setThickness] = useState<string>(''); // Default empty string to force input
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<MetalSheetCountResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // AR States
    const [isARMode, setIsARMode] = useState(false);
    const [arRefType, setArRefType] = useState<'CARD' | 'COIN'>('CARD');
    const [arScale, setArScale] = useState(1.0); // Simple zoom factor for overlay
    const arVideoRef = useRef<HTMLVideoElement>(null);
    const [arStream, setArStream] = useState<MediaStream | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    // --- STANDARD CAMERA HANDLERS ---
    const startCamera = async () => {
        setIsCameraActive(true);
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error(err);
            setError("No se pudo acceder a la cámara.");
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.9); // High quality for visual counting
            setImagePreview(base64);
            stopCamera();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            setImagePreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleCount = async () => {
        if (!imagePreview || !material || !thickness) {
            setError("Por favor completa todos los campos (Grosor incluido) e incluye una imagen.");
            return;
        }

        const thickVal = parseFloat(thickness.replace(',', '.'));
        if (isNaN(thickVal) || thickVal <= 0) {
            setError("Introduce un grosor válido en mm.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // Remove header for API processing
            const base64Data = imagePreview.split(',')[1];
            const data = await countMetalSheets(base64Data, material, thickVal);
            setResult(data);
        } catch (err: any) {
            setError(err.message || "Error al procesar la imagen.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setImagePreview(null);
        setResult(null);
        setError(null);
        setIsCameraActive(false);
    };

    // --- AR FUNCTIONS ---
    const startAR = async () => {
        setIsARMode(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            setArStream(stream);
            // Wait for ref to be available in render
            setTimeout(() => {
                if (arVideoRef.current) {
                    arVideoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error("AR Error", err);
            alert("No se pudo iniciar la cámara para AR.");
            setIsARMode(false);
        }
    };

    const stopAR = () => {
        if (arStream) {
            arStream.getTracks().forEach(t => t.stop());
            setArStream(null);
        }
        setIsARMode(false);
    };

    // Clean up AR on unmount
    useEffect(() => {
        return () => {
            if (arStream) arStream.getTracks().forEach(t => t.stop());
        };
    }, []);

    // --- AR OVERLAY COMPONENT ---
    const renderAROverlay = () => {
        if (!result) return null;

        // Constants for reference objects (in mm)
        // We use the "height" in the view as the measuring axis
        const REF_HEIGHT_MM = arRefType === 'CARD' ? 53.98 : 23.25;

        // Base pixels for reference box on screen (at scale 1)
        const BASE_REF_PIXELS = 150;

        // Dynamic pixels based on scale slider
        const currentRefPixels = BASE_REF_PIXELS * arScale;

        // Calculate Target Pixels based on ratio
        // (TargetHeight / RefHeight) * RefPixels
        const ratio = result.theoreticalBlockHeightMm / REF_HEIGHT_MM;
        const targetPixels = currentRefPixels * ratio;

        return (
            <div className="fixed inset-0 z-[100] bg-black">
                {/* Camera Feed */}
                <video
                    ref={arVideoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* UI Overlay Layer */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">

                    {/* Header */}
                    <div className="bg-black/60 p-4 text-white pointer-events-auto flex justify-between items-start">
                        <div>
                            <h3 className="font-bold flex items-center gap-2">
                                <RulerIcon className="h-5 w-5 text-cyan-400" />
                                Regla AR
                            </h3>
                            <p className="text-xs opacity-80 max-w-[250px]">
                                1. Coloca una <strong>{arRefType === 'CARD' ? 'Tarjeta' : 'Moneda 1€'}</strong> junto al bloque.
                                <br />
                                2. Aléjate hasta que encaje en el recuadro VERDE.
                                <br />
                                3. Verifica si el bloque llena la barra ROJA.
                            </p>
                        </div>
                        <button onClick={stopAR} className="p-2 bg-white/20 rounded-full">
                            <CloseIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Augmented Reality Guides */}
                    <div className="flex-grow relative flex items-center justify-center gap-8">

                        {/* Reference Box (Green) */}
                        <div
                            className="border-4 border-green-500 bg-green-500/10 flex items-center justify-center relative transition-all duration-100"
                            style={{
                                height: `${currentRefPixels}px`,
                                width: arRefType === 'CARD' ? `${currentRefPixels * 1.58}px` : `${currentRefPixels}px`, // Card ratio or square for coin
                                borderRadius: arRefType === 'COIN' ? '50%' : '8px'
                            }}
                        >
                            <span className="bg-green-500 text-black text-xs font-bold px-2 py-1 rounded">
                                {arRefType === 'CARD' ? 'Tarjeta' : '1€'}
                            </span>
                            {/* Baseline Helper */}
                            <div className="absolute -bottom-10 left-0 right-0 border-b-2 border-white/50 text-center text-white/50 text-[10px]">Línea Base</div>
                        </div>

                        {/* Target Height Bar (Red) */}
                        <div className="flex flex-col items-center justify-end h-full absolute" style={{ bottom: '50%', transform: 'translateY(50%)' }}>
                            {/* Only showing this relative to the center alignment is tricky without fixed baseline.
                                 Let's visually align bottoms. */}
                        </div>

                        {/* Better Layout: Side by Side Bottom Aligned */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="flex items-end gap-8" style={{ height: Math.max(currentRefPixels, targetPixels) + 100 }}>
                                {/* Reference Column */}
                                <div className="flex flex-col items-center">
                                    <div
                                        className="border-4 border-green-500 bg-green-500/20 mb-0 flex items-center justify-center"
                                        style={{
                                            height: `${currentRefPixels}px`,
                                            width: arRefType === 'CARD' ? `${currentRefPixels * 1.58}px` : `${currentRefPixels}px`,
                                            borderRadius: arRefType === 'COIN' ? '50%' : '8px'
                                        }}
                                    >
                                    </div>
                                    <div className="text-green-400 font-bold text-xs mt-2 text-center">REFERENCIA<br />{REF_HEIGHT_MM}mm</div>
                                </div>

                                {/* Target Column */}
                                <div className="flex flex-col items-center relative">
                                    <div
                                        className="border-4 border-red-500 bg-red-500/20 mb-0 flex flex-col justify-between"
                                        style={{
                                            height: `${targetPixels}px`,
                                            width: '60px',
                                        }}
                                    >
                                        <div className="w-full border-t border-red-500"></div>
                                        <div className="w-full border-b border-red-500"></div>
                                    </div>
                                    <div className="text-red-400 font-bold text-xs mt-2 text-center">BLOQUE<br />~{result.theoreticalBlockHeightMm.toFixed(0)}mm</div>

                                    {/* Compare line */}
                                    <div className="absolute bottom-0 left-[-20px] right-[-20px] border-b border-dashed border-white/30"></div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer Controls */}
                    <div className="bg-black/80 p-6 pointer-events-auto pb-10 safe-area-inset-bottom">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="text-white font-bold text-xs">Escala</span>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.05"
                                value={arScale}
                                onChange={(e) => setArScale(parseFloat(e.target.value))}
                                className="flex-grow accent-cyan-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setArRefType('CARD')}
                                className={`py-3 rounded-xl font-bold text-sm border ${arRefType === 'CARD' ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-transparent border-slate-600 text-slate-400'}`}
                            >
                                Usar Tarjeta
                            </button>
                            <button
                                onClick={() => setArRefType('COIN')}
                                className={`py-3 rounded-xl font-bold text-sm border ${arRefType === 'COIN' ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-transparent border-slate-600 text-slate-400'}`}
                            >
                                Usar Moneda 1€
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-2xl mx-auto pb-24">
            {isARMode && renderAROverlay()}

            <div className="flex flex-col items-center justify-center gap-3 mb-8 text-center relative">
                <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400 shadow-sm relative group cursor-help">
                    <LayersIcon className="h-10 w-10" />
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold animate-pulse">?</div>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Chapero Digital Pro</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Conteo por Visión Artificial + Verificación Física.</p>
                    <button
                        onClick={() => alert(`CONSEJOS PARA FOTO PERFECTA:\n\n1. 📐 PERFIL PURO: Toma la foto exactamente de lado a las chapas, no desde arriba ni en ángulo.\n2. 💡 LUZ DIFUSA: Evita reflejos directos del sol o flash que oculten los bordes.\n3. 🔍 ENCUADRE: Acércate lo suficiente para ver las líneas de separación, pero abarca todo el bloque.\n4. 🚫背景 LIMPIO: Evita fondos confusos detrás del bloque.`)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
                    >
                        <InfoIcon className="h-3 w-3" /> Ver Guía de Captura
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

                {/* 1. Configuration Form */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Material</label>
                            <select
                                value={material}
                                onChange={e => setMaterial(e.target.value)}
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-transparent focus:border-orange-500 outline-none font-bold text-slate-800 dark:text-white"
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
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-transparent focus:border-orange-500 outline-none font-bold text-slate-800 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center gap-3 text-xs text-blue-700 dark:text-blue-300">
                        <SparklesIcon className="h-5 w-5 flex-shrink-0" />
                        <p>La IA usará el <strong>grosor ({thickness || 'X'}mm)</strong> para validar si el conteo visual es físicamente posible.</p>
                    </div>
                </div>

                {/* 2. Image Capture Area */}
                <div className="relative bg-slate-50 dark:bg-black/40 min-h-[300px] flex flex-col items-center justify-center p-4">
                    {isCameraActive ? (
                        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover" />
                            <button
                                onClick={capturePhoto}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-lg active:scale-95 transition-transform"
                            >
                                <div className="h-14 w-14 rounded-full border-4 border-orange-500 bg-white" />
                            </button>
                            <button
                                onClick={stopCamera}
                                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full"
                            >
                                ✕
                            </button>
                        </div>
                    ) : imagePreview ? (
                        <div className="relative w-full">
                            <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-xl shadow-md" />
                            <button
                                onClick={resetForm}
                                className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <button
                                onClick={startCamera}
                                className="flex flex-col items-center justify-center h-32 w-32 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-800 hover:scale-105 transition-transform"
                            >
                                <CameraIcon className="h-10 w-10 mb-2" />
                                <span className="text-xs font-bold uppercase">Cámara</span>
                            </button>
                            <span className="text-slate-400 text-xs font-bold uppercase">- O -</span>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                            >
                                <UploadIcon className="h-4 w-4" /> Subir Foto
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

                {/* 3. Action / Result Area */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold text-center">
                            {error}
                        </div>
                    )}

                    {!result && !loading && (
                        <button
                            onClick={handleCount}
                            disabled={!imagePreview || !thickness}
                            className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            <SparklesIcon className="h-5 w-5" />
                            Analizar & Verificar
                        </button>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-4">
                            <LoadingIcon className="h-8 w-8 text-orange-500 animate-spin mb-2" />
                            <p className="text-sm font-bold text-slate-500 animate-pulse">
                                IA contando cantos y calculando altura...
                            </p>
                        </div>
                    )}

                    {result && (
                        <div className="animate-slide-up space-y-4">

                            {/* Visual Count Card */}
                            <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl p-5 border border-slate-300 dark:border-slate-700 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <LayersIcon className="h-16 w-16" />
                                </div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Conteo Visual IA</span>
                                <div className="text-6xl font-black text-slate-800 dark:text-white mb-2 leading-none">
                                    {result.estimatedCount}
                                </div>
                                <span className="text-sm text-slate-500 font-bold uppercase">Chapas</span>
                                <div className="flex justify-center gap-2 mt-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${result.confidence === 'high' ? 'bg-green-100 text-green-700 border-green-200' :
                                            result.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                'bg-red-100 text-red-700 border-red-200'
                                        }`}>
                                        Confianza: {result.confidence === 'high' ? 'Alta' : result.confidence === 'medium' ? 'Media' : 'Baja'}
                                    </span>
                                </div>
                            </div>

                            {/* Verification Card (The Logic Step) */}
                            <div className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-xl border-l-4 border-cyan-500 shadow-sm">
                                <h3 className="flex items-center gap-2 font-bold text-cyan-800 dark:text-cyan-300 mb-2">
                                    <CheckIcon className="h-5 w-5" />
                                    Validación de Coherencia
                                </h3>
                                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                                    <p>
                                        Si hay <strong>{result.estimatedCount}</strong> chapas de <strong>{thickness}mm</strong>...
                                    </p>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-cyan-100 dark:border-cyan-800/30 flex justify-between items-center">
                                        <span className="text-xs uppercase font-bold text-slate-500">Altura del Bloque</span>
                                        <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                                            ~{(result.theoreticalBlockHeightMm / 10).toFixed(1)} cm
                                        </span>
                                    </div>
                                    <p className="text-xs italic text-slate-500 mt-2 border-t border-cyan-200 dark:border-cyan-800 pt-2">
                                        "{result.visualNotes}"
                                    </p>

                                    <button
                                        onClick={startAR}
                                        className="w-full mt-2 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                                    >
                                        <RulerIcon className="h-5 w-5" />
                                        Verificar con Regla AR
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={resetForm}
                                className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                            >
                                Nuevo Análisis
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChaperoCountView;
