import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";

const PdfPreview = ({ base64Data, blobUrl }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    const loadPDF = async () => {
      if (!base64Data && !blobUrl) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let url;
        if (blobUrl) {
          url = blobUrl;
        } else if (base64Data) {
          // Convert base64 to Uint8Array
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Load with pdf-lib
          const pdfDoc = await PDFDocument.load(bytes);
          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          url = URL.createObjectURL(blob);
        }

        setPdfUrl(url);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError(err.message || "Failed to load PDF");
        setLoading(false);
      }
    };

    loadPDF();
    
    return () => {
      if (pdfUrl && !blobUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [base64Data, blobUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <p className="mb-2">Failed to render PDF</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
      <embed
        src={pdfUrl}
        type="application/pdf"
        className="w-full h-full"
        style={{ minHeight: "600px" }}
      />
    </div>
  );
};

export default PdfPreview;
