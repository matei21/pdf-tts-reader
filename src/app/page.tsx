"use client";

import { useEffect, useState, useRef } from "react";
import { storePdf, getPdf, listPdfs, deletePdf } from "@/lib/db";
import PdfViewer from "@/components/PdfViewer";

interface PdfEntry {
  id: string;
  name: string;
  storedAt: number;
}

export default function Home() {
  const [pdfs, setPdfs] = useState<PdfEntry[]>([]);
  const [activePdf, setActivePdf] = useState<{
    data: ArrayBuffer;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listPdfs().then(setPdfs);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const data = await file.arrayBuffer();
    await storePdf(file.name, data);
    const list = await listPdfs();
    setPdfs(list);
    setLoading(false);

    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpen = async (id: string) => {
    setLoading(true);
    const pdf = await getPdf(id);
    if (pdf) {
      setActivePdf({ data: pdf.data, name: pdf.name });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deletePdf(id);
    setPdfs(await listPdfs());
  };

  if (activePdf) {
    return (
      <PdfViewer
        pdfData={activePdf.data}
        pdfName={activePdf.name}
        onBack={() => setActivePdf(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-16 px-4">
      <div className="max-w-xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PDF Reader</h1>
        <p className="text-gray-500 mb-8">
          Upload a PDF and have it read aloud. Files are stored in your browser.
        </p>

        {/* Upload */}
        <label className="block w-full cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors mb-8">
          <div className="text-gray-400 text-4xl mb-2">+</div>
          <div className="text-sm text-gray-500">
            {loading ? "Processing..." : "Click to upload a PDF"}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleUpload}
            className="hidden"
            disabled={loading}
          />
        </label>

        {/* Library */}
        {pdfs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Your PDFs</h2>
            <div className="space-y-2">
              {pdfs
                .sort((a, b) => b.storedAt - a.storedAt)
                .map((pdf) => (
                  <div
                    key={pdf.id}
                    className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 hover:shadow-sm transition-shadow"
                  >
                    <button
                      onClick={() => handleOpen(pdf.id)}
                      className="flex-1 text-left truncate text-sm font-medium text-gray-800 hover:text-blue-600"
                    >
                      {pdf.name}
                    </button>
                    <span className="text-xs text-gray-400 mx-3 shrink-0">
                      {new Date(pdf.storedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDelete(pdf.id, pdf.name)}
                      className="text-gray-400 hover:text-red-500 text-sm shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
