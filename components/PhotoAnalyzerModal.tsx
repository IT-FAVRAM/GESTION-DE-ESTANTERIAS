
import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, CameraIcon, LoadingIcon, ErrorIcon, UploadIcon, KeyboardIcon } from './Icons';
import { extractCodeFromImage, extractCombinedItemData } from '../lib/gemini';

interface PhotoAnalyzerModalProps {
    onCodeExtracted: (code: string | { article: string; order: string }) => void;
    onClose: () => void;
    onRequestManual?: () => void;
    instruction?: string;
    mode?: 'single' | 'combined'; // 'combined' for Article + Order in one shot
}

type Step = 'camera' | 'processing' | 'confirm' | 'error';

const PhotoAnalyzerModal: React.FC<PhotoAnalyzerModalProps> = ({ onCodeExtracted, onClose, onRequestManual, instruction, mode = 'single' }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('camera');

    // Single mode state
    const [extractedCode, setExtractedCode] = useState('');

    // Combined mode state
    const [combinedData, setCombinedData] = useState({ article: '', order: '' });

    const [errorMessage, setErrorMessage] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const isLocationScan = instruction?.toLowerCase().includes('ubicación') || instruction?.toLowerCase().includes('cartel');
    const currentContext = instruction?.toLowerCase().includes('orden') || instruction?.toLowerCase().includes('of')
        ? 'order'
        : (isLocationScan ? 'location' : 'article');

    useEffect(() => {
        let stream: MediaStream | null = null;
        let isMounted = true;

        const startCamera = async () => {
            if (step !== 'camera') {
                if (videoRef.current && videoRef.current.srcObject) {
                    const s = videoRef.current.srcObject as MediaStream;
                    s.getTracks().forEach(t => t.stop());
                    videoRef.current.srcObject = null;
                }
                return;
            }

            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });

                if (!isMounted) {
                    s.getTracks().forEach(track => track.stop());
                    return;
                }

                stream = s;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                if (!isMounted) return;
                console.error("Camera Error:", err);
                setErrorMessage("No se pudo acceder a la cámara. Intenta subir una foto.");
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [step]);

    // Try local BarcodeDetector API first, then fall back to Gemini
    const tryLocalBarcodeDetection = async (base64Image: string): Promise<string | null> => {
        // Check if BarcodeDetector API is available
        if (!('BarcodeDetector' in window)) return null;

        try {
            // Convert base64 to ImageBitmap
            const response = await fetch(base64Image);
            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);

            // @ts-ignore - BarcodeDetector is not yet in TypeScript types
            const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'qr_code', 'data_matrix'] });
            const barcodes = await detector.detect(imageBitmap);

            if (barcodes && barcodes.length > 0) {
                return barcodes[0].rawValue;
            }
        } catch (e) {
            console.log('Local barcode detection failed, falling back to Gemini:', e);
        }
        return null;
    };

    const processImage = async (base64Image: string) => {
        setImagePreview(base64Image);
        setStep('processing');

        try {
            const rawBase64 = base64Image.split(',')[1];

            // --- LOCAL-FIRST OPTIMIZATION ---
            // Try native BarcodeDetector API first (faster, no network)
            if (mode === 'single' && currentContext === 'article') {
                const localResult = await tryLocalBarcodeDetection(base64Image);
                if (localResult) {
                    setExtractedCode(localResult.toUpperCase());
                    setStep('confirm');
                    return; // Skip Gemini call if local detection succeeded
                }
            }

            // Fallback to Gemini for complex scenarios
            if (mode === 'combined') {
                const data = await extractCombinedItemData(rawBase64);
                setCombinedData({ article: data.article, order: data.orderId });
            } else {
                // Pass context to single extractor
                const code = await extractCodeFromImage(rawBase64, currentContext as any);
                setExtractedCode(code.toUpperCase());
            }

            setStep('confirm');
        } catch (error) {
            setErrorMessage((error as Error).message || "Error desconocido al analizar la imagen.");
            setStep('error');
        }
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Performance Optimization: Downscale huge camera inputs
        // 640px is sufficient for OCR and much faster to upload/process than 1080p+
        const maxDim = 640;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round(height * (maxDim / width));
                width = maxDim;
            } else {
                width = Math.round(width * (maxDim / height));
                height = maxDim;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, width, height);
        // Reduced quality to 0.5 for faster transfer (high compression, good enough for text)
        const base64Image = canvas.toDataURL('image/jpeg', 0.5);
        processImage(base64Image);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Optimization: Max 640px is enough for text analysis
                const maxDim = 640;
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    } else {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Lower quality JPEG for speed
                    const base64Image = canvas.toDataURL('image/jpeg', 0.5);
                    processImage(base64Image);
                }
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleConfirm = () => {
        if (mode === 'combined') {
            if (combinedData.article.trim()) {
                onCodeExtracted(combinedData);
            }
        } else {
            if (extractedCode.trim()) {
                onCodeExtracted(extractedCode.trim());
            }
        }
    };

    const handleRetry = () => {
        setImagePreview(null);
        setExtractedCode('');
        setCombinedData({ article: '', order: '' });
        setErrorMessage('');
        setStep('camera');
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" role="dialog" aria-modal="true">
            {/* Header */}
            <div className="relative z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <h2 className="text-white font-bold flex items-center gap-2">
                    <CameraIcon className="h-5 w-5 text-purple-400" />
                    <span className="capitalize">{instruction || 'Foto Análisis AI'}</span>
                </h2>
                <button onClick={onClose} className="p-2 rounded-full bg-slate-800/50 text-white hover:bg-slate-700 transition-colors">
                    <CloseIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="flex-grow relative flex items-center justify-center overflow-hidden bg-black">

                {step === 'camera' && (
                    <>
                        {errorMessage ? (
                            <div className="absolute inset-0 flex items-center justify-center p-6">
                                <p className="text-red-400 text-center">{errorMessage}</p>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        )}

                        <canvas ref={canvasRef} className="hidden" />

                        {/* Overlay Box */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className={`${isLocationScan ? 'w-[85%] h-32 md:h-48' : 'w-64 h-64'} border-2 border-dashed border-purple-400/50 rounded-xl relative transition-all duration-300`}>
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-purple-500"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-purple-500"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-purple-500"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-purple-500"></div>
                            </div>
                        </div>

                        <div className="absolute bottom-8 w-full flex justify-center items-center gap-8 z-20">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="h-14 w-14 rounded-full bg-slate-800/80 text-white flex items-center justify-center border border-slate-600 hover:bg-slate-700 backdrop-blur-sm transition-transform active:scale-95"
                                title="Subir foto"
                            >
                                <UploadIcon className="h-6 w-6" />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                            />

                            <button
                                onClick={handleCapture}
                                disabled={!!errorMessage}
                                className="h-16 w-16 rounded-full bg-white border-4 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] active:scale-90 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Tomar Foto"
                            />

                            {onRequestManual ? (
                                <button
                                    onClick={onRequestManual}
                                    className="h-14 w-14 rounded-full bg-slate-800/80 text-white flex items-center justify-center border border-slate-600 hover:bg-slate-700 backdrop-blur-sm transition-transform active:scale-95"
                                    title="Entrada Manual"
                                >
                                    <KeyboardIcon className="h-6 w-6" />
                                </button>
                            ) : (
                                <div className="w-14"></div>
                            )}
                        </div>
                        <p className="absolute bottom-32 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full animate-pulse text-center max-w-[80%]">
                            {instruction ? `Apunta a: ${instruction}` : 'Apunta al código'}
                        </p>
                    </>
                )}

                {step === 'processing' && (
                    <div className="flex flex-col items-center gap-4">
                        {imagePreview && <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />}
                        <div className="relative z-10 flex flex-col items-center">
                            <LoadingIcon className="h-12 w-12 text-purple-500 mb-2" />
                            <p className="text-white font-bold text-lg animate-pulse">Analizando imagen...</p>
                            <p className="text-white/60 text-sm">Gemini está leyendo...</p>
                        </div>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-md p-6 relative z-10 h-full overflow-y-auto">
                        {imagePreview && (
                            <div className="w-full h-32 md:h-48 rounded-xl overflow-hidden border-2 border-purple-500 shadow-lg mb-2 flex-shrink-0">
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 flex-shrink-0">
                            {mode === 'combined' ? (
                                <>
                                    <div className="mb-4">
                                        <label className="text-slate-400 text-xs uppercase font-bold mb-1 block">Artículo</label>
                                        <input
                                            type="text"
                                            value={combinedData.article}
                                            onChange={(e) => setCombinedData(prev => ({ ...prev, article: e.target.value.toUpperCase() }))}
                                            className="w-full bg-slate-800 text-white text-lg font-mono p-2 rounded border border-slate-700 focus:border-cyan-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-slate-400 text-xs uppercase font-bold mb-1 block">Orden (OF)</label>
                                        <input
                                            type="text"
                                            value={combinedData.order}
                                            onChange={(e) => setCombinedData(prev => ({ ...prev, order: e.target.value.toUpperCase() }))}
                                            className="w-full bg-slate-800 text-white text-lg font-mono p-2 rounded border border-slate-700 focus:border-purple-500 focus:outline-none"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <label className="text-slate-400 text-xs uppercase font-bold mb-2 block">
                                        {isLocationScan ? 'Ubicación Detectada' : 'Código Detectado'}
                                    </label>
                                    <input
                                        type="text"
                                        value={extractedCode}
                                        onChange={(e) => setExtractedCode(e.target.value.toUpperCase())}
                                        className="w-full bg-slate-800 text-white text-xl font-mono p-2 rounded border border-slate-700 focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                            )}
                            <p className="text-xs text-slate-500 mt-2">
                                Si es incorrecto, puedes editarlo manualmente.
                            </p>
                        </div>

                        <div className="flex gap-3 w-full mt-auto">
                            <button onClick={handleRetry} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700">
                                Reintentar
                            </button>
                            <button onClick={handleConfirm} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 shadow-lg shadow-purple-900/20">
                                Confirmar
                            </button>
                        </div>
                    </div>
                )}

                {step === 'error' && (
                    <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm relative z-10">
                        <div className="p-4 bg-red-900/20 rounded-full">
                            <ErrorIcon className="h-12 w-12 text-red-500" />
                        </div>
                        <h3 className="text-white text-xl font-bold">No se pudo leer</h3>
                        <p className="text-slate-400">{errorMessage}</p>

                        <div className="flex gap-3 w-full mt-4">
                            <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl">
                                Cancelar
                            </button>
                            <button onClick={handleRetry} className="flex-1 py-3 bg-white text-slate-900 font-bold rounded-xl">
                                Reintentar
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PhotoAnalyzerModal;
