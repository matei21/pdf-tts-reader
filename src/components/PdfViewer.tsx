"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  speak,
  stopSpeaking,
  pauseSpeaking,
  resumeWithSettings,
  getVoices,
  SPEED_OPTIONS,
  type SpeedOption,
} from "@/lib/tts";

interface PdfViewerProps {
  pdfData: ArrayBuffer;
  pdfName: string;
  onBack: () => void;
}

type PdfjsLib = typeof import("pdfjs-dist");
type PDFDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

let pdfjsPromise: Promise<PdfjsLib> | null = null;

function loadPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

export default function PdfViewer({ pdfData, pdfName, onBack }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageText, setPageText] = useState("");
  const [scale, setScale] = useState(1.5);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [speed, setSpeed] = useState<SpeedOption>(1.0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausedState, setIsPausedState] = useState(false);

  const [selectionText, setSelectionText] = useState("");
  const [showSelectionButton, setShowSelectionButton] = useState(false);
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pdfjsRef = useRef<PdfjsLib | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const v = getVoices();
      if (v.length > 0) {
        setVoices(v);
        const stored = localStorage.getItem("tts-voice");
        if (stored && v.find((voice) => voice.name === stored)) {
          setSelectedVoice(stored);
        } else {
          setSelectedVoice(v[0].name);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const storedSpeed = localStorage.getItem("tts-speed");
    if (storedSpeed) setSpeed(parseFloat(storedSpeed) as SpeedOption);

    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("tts-voice", selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem("tts-speed", String(speed));
  }, [speed]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const pdfjs = await loadPdfjs();
      pdfjsRef.current = pdfjs;
      const doc = await pdfjs.getDocument({ data: pdfData.slice(0) }).promise;
      if (!cancelled) {
        setPdf(doc);
        setTotalPages(doc.numPages);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pdfData]);

  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdf || !canvasRef.current || !textLayerRef.current) return;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;

      const textContent = await page.getTextContent();
      const textLayer = textLayerRef.current;
      textLayer.innerHTML = "";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;

      let fullText = "";
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (!("str" in item) || !("transform" in item)) continue;
        const ti = item as { str: string; transform: number[]; hasEOL: boolean };
        const tx = ti.transform;
        const x = tx[4] * scale;
        const y = viewport.height - tx[5] * scale;
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * scale;

        const span = document.createElement("span");
        span.textContent = ti.str;
        span.style.position = "absolute";
        span.style.left = `${x}px`;
        span.style.top = `${y - fontSize}px`;
        span.style.fontSize = `${fontSize}px`;
        span.style.fontFamily = "sans-serif";
        span.style.color = "transparent";
        span.style.whiteSpace = "pre";
        span.style.lineHeight = "1";
        textLayer.appendChild(span);

        if (lastY !== null && Math.abs(tx[5] - lastY) > 2) {
          fullText += "\n";
        }
        fullText += ti.str;
        if (ti.hasEOL) fullText += "\n";
        lastY = tx[5];
      }

      setPageText(fullText.trim());
    },
    [pdf, scale]
  );

  useEffect(() => {
    if (pdf) renderPage(currentPage);
  }, [pdf, currentPage, renderPage]);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 0) {
        setSelectionText(text);
        const range = sel!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPos({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
        setShowSelectionButton(true);
      } else {
        setShowSelectionButton(false);
        setSelectionText("");
      }
    };

    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  const getVoice = () => voices.find((v) => v.name === selectedVoice) || null;

  const readText = (text: string) => {
    stopSpeaking();
    setIsPlaying(true);
    setIsPausedState(false);
    speak(text, getVoice(), speed, () => {
      setIsPlaying(false);
      setIsPausedState(false);
    });
  };

  const handleReadPage = () => readText(pageText);

  const handleReadSelection = () => {
    readText(selectionText);
    setShowSelectionButton(false);
  };

  const handlePause = () => {
    if (isPausedState) {
      resumeWithSettings(getVoice(), speed, () => {
        setIsPlaying(false);
        setIsPausedState(false);
      });
      setIsPausedState(false);
    } else {
      pauseSpeaking();
      setIsPausedState(true);
    }
  };

  const handleStop = () => {
    stopSpeaking();
    setIsPlaying(false);
    setIsPausedState(false);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      stopSpeaking();
      setIsPlaying(false);
      setIsPausedState(false);
      setCurrentPage(page);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="shrink-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4 flex-wrap shadow-sm">
        <button
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
        >
          &larr; Back
        </button>

        <span className="text-sm font-medium truncate max-w-[200px] text-gray-900 dark:text-gray-100" title={pdfName}>
          {pdfName}
        </span>

        {/* Page nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-400 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-gray-700 disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-sm tabular-nums text-gray-700 dark:text-gray-200">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-14 text-center border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />{" "}
            / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-400 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-gray-700 disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-400 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            -
          </button>
          <span className="text-sm w-12 text-center text-gray-700 dark:text-gray-200">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-400 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            +
          </button>
        </div>
      </div>

      {/* TTS controls */}
      <div className="shrink-0 z-20 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-4 flex-wrap">
        <button
          onClick={handleReadPage}
          className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          Read Page
        </button>

        {isPlaying && (
          <>
            <button
              onClick={handlePause}
              className="px-3 py-1.5 rounded bg-yellow-500 text-white hover:bg-yellow-600 text-sm font-medium transition-colors"
            >
              {isPausedState ? "Resume" : "Pause"}
            </button>
            <button
              onClick={handleStop}
              className="px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition-colors"
            >
              Stop
            </button>
          </>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Speed:</label>
          <select
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value) as SpeedOption)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Voice:</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 max-w-[250px]"
          >
            {(() => {
              const roVoices = voices.filter((v) => v.lang.startsWith("ro"));
              const enVoices = voices.filter((v) => v.lang.startsWith("en"));
              return (
                <>
                  {roVoices.length > 0 && (
                    <optgroup label="Romanian">
                      {roVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {enVoices.length > 0 && (
                    <optgroup label="English">
                      {enVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </select>
        </div>
      </div>

      {/* PDF display */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center py-6">
        <div className="relative inline-block shadow-lg overflow-hidden">
          <canvas ref={canvasRef} className="block" />
          <div
            ref={textLayerRef}
            className="absolute top-0 left-0 select-text overflow-hidden"
            style={{ userSelect: "text" }}
          />
        </div>
      </div>

      {/* Floating "Read Selection" button */}
      {showSelectionButton && selectionText && (
        <button
          onClick={handleReadSelection}
          className="fixed z-50 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-lg hover:bg-blue-700 transition-colors"
          style={{
            left: `${selectionPos.x}px`,
            top: `${selectionPos.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          Read Selection
        </button>
      )}
    </div>
  );
}
