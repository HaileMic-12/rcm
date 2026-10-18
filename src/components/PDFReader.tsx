"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use local bundled worker to prevent Vercel CDN fetch and network errors
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PDFReader() {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col items-center w-full">
      
      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
        <button 
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber(pageNumber - 1)}
          className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 disabled:opacity-50 hover:bg-slate-100 font-bold text-slate-700 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <p className="text-slate-600 font-medium min-w-[120px] text-center">
          Page {pageNumber} of {numPages || "..."}
        </p>
        <button 
          disabled={numPages === null || pageNumber >= numPages}
          onClick={() => setPageNumber(pageNumber + 1)}
          className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 disabled:opacity-50 hover:bg-slate-100 font-bold text-slate-700 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      {/* PDF Document Viewer */}
      <div className="border border-slate-200 shadow-xl rounded-2xl overflow-x-auto bg-white max-w-full p-4">
        <Document 
          file="/anatomy-book.pdf" 
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex justify-center"
          loading={
            <div className="p-16 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-slate-500 font-medium">Loading PDF...</p>
            </div>
          }
          error={
            <div className="p-10 text-center text-rose-600 bg-rose-50 rounded-xl">
              <p className="font-bold text-lg">Failed to load PDF.</p>
              <p className="text-sm mt-2 text-rose-500">Ensure your file is named <b>anatomy-book.pdf</b> and is directly inside the <b>public</b> folder.</p>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-sm border border-slate-100"
          />
        </Document>
      </div>
    </div>
  );
}