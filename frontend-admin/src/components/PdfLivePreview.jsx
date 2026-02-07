import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import { templatesAPI } from "../api";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/**
 * PdfLivePreview - Displays a PDF with fields rendered by the backend using pdf-lib
 * This ensures the preview matches exactly what will be in the final certificate
 * 
 * The component:
 * 1. Sends current field positions to backend
 * 2. Backend generates PDF with sample text using SAME code as certificate generation
 * 3. Displays that PDF using pdfjs
 * 4. Overlay handles click/drag interactions
 */
const PdfLivePreview = ({
  templateId,
  baseUrl, // Original PDF URL without fields (for fallback)
  fields = [],
  onClick,
  onFieldClick,
  onFieldDrag,
  selectedFieldIndex,
}) => {
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 842, height: 595 });
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const scale = 1.5;

  // Track if we need to regenerate after drag ends
  const needsRegenerateRef = useRef(false);
  const lastFieldsRef = useRef(JSON.stringify(fields));

  // Generate preview PDF from backend
  const generatePreview = useCallback(async (force = false) => {
    if (!templateId) return;
    
    // Don't regenerate while dragging
    if (dragging !== null && !force) {
      needsRegenerateRef.current = true;
      return;
    }

    // Check if fields actually changed
    const fieldsJson = JSON.stringify(fields);
    if (!force && fieldsJson === lastFieldsRef.current && previewUrl) {
      return;
    }
    lastFieldsRef.current = fieldsJson;

    try {
      setIsGenerating(true);
      
      // Call backend to generate preview PDF with fields
      const response = await templatesAPI.previewPlaceholders(templateId, fields);
      
      // Create blob URL from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Revoke old URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setPreviewUrl(url);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("Failed to generate preview:", err);
      // Fallback to base URL if available
      if (baseUrl) {
        setPreviewUrl(baseUrl);
      } else {
        setError("Failed to generate preview");
      }
      setLoading(false);
    } finally {
      setIsGenerating(false);
    }
  }, [templateId, fields, baseUrl, dragging, previewUrl]);

  // Initial load only - generate preview once when component mounts or templateId changes
  useEffect(() => {
    if (templateId) {
      generatePreview(true);
    }
  }, [templateId]);

  // Regenerate when dragging ends (if fields changed during drag)
  useEffect(() => {
    if (dragging === null && needsRegenerateRef.current) {
      needsRegenerateRef.current = false;
      // Delay slightly to let state settle
      const timer = setTimeout(() => {
        generatePreview(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dragging]);

  // Track field count changes (new field added or removed) - regenerate
  const prevFieldCountRef = useRef(fields.length);
  useEffect(() => {
    if (fields.length !== prevFieldCountRef.current) {
      prevFieldCountRef.current = fields.length;
      // New field added or removed, regenerate after a short delay
      const timer = setTimeout(() => {
        generatePreview(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [fields.length]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  // Render PDF when preview URL changes
  useEffect(() => {
    if (!previewUrl) return;

    let isMounted = true;

    const loadPDF = async () => {
      let attempts = 0;
      while (!pdfCanvasRef.current && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      if (!pdfCanvasRef.current) {
        setError("Canvas element not ready");
        setLoading(false);
        return;
      }

      try {
        const loadingTask = pdfjsLib.getDocument(previewUrl);
        const pdf = await loadingTask.promise;

        if (!isMounted) return;

        const page = await pdf.getPage(1);

        if (!isMounted) return;

        // Get actual PDF dimensions
        const viewport = page.getViewport({ scale: 1 });
        setPdfDimensions({ width: viewport.width, height: viewport.height });

        // Render at display scale
        const scaledViewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;

        if (!canvas) return;

        const context = canvas.getContext("2d");
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (!isMounted) return;

        // Setup overlay canvas for interactions
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = scaledViewport.width;
          overlayCanvasRef.current.height = scaledViewport.height;
          drawFieldMarkers();
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        if (isMounted) {
          setError(err.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
    };
  }, [previewUrl, scale]);

  // Draw field interaction markers (just circles for clicking/dragging, no text)
  const drawFieldMarkers = useCallback(() => {
    if (!overlayCanvasRef.current || loading) return;

    const ctx = overlayCanvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    fields.forEach((field, idx) => {
      const x = field.x_position * scale;
      const y = field.y_position * scale;
      const isSelected = idx === selectedFieldIndex;

      ctx.save();

      // Draw position marker circle
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.9)" : "rgba(239, 68, 68, 0.9)";
      ctx.fill();

      // Draw alignment indicator
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        field.text_align === "CENTER" ? "C" : field.text_align === "RIGHT" ? "R" : "L",
        x,
        y
      );

      // Draw field label
      const label = `${field.field_type || "Field"}`;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const labelWidth = ctx.measureText(label).width;

      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.95)" : "rgba(239, 68, 68, 0.95)";
      ctx.fillRect(x + 15, y - 10, labelWidth + 10, 20);

      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 20, y - 5);

      ctx.restore();
    });
  }, [fields, selectedFieldIndex, scale, loading]);

  // Redraw markers when fields or selection changes
  useEffect(() => {
    drawFieldMarkers();
  }, [drawFieldMarkers]);

  // Convert screen coordinates to PDF coordinates
  const screenToPdfCoords = (clientX, clientY) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return null;

    const rect = overlayCanvas.getBoundingClientRect();
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;

    const canvasX = (displayX / rect.width) * overlayCanvas.width;
    const canvasY = (displayY / rect.height) * overlayCanvas.height;

    const pdfX = canvasX / scale;
    const pdfY = canvasY / scale;

    return { x: Math.round(pdfX), y: Math.round(pdfY) };
  };

  // Find field at position
  const findFieldAtPosition = (coords) => {
    if (!coords) return -1;

    const clickRadius = 40 / scale;

    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      const dx = coords.x - field.x_position;
      const dy = coords.y - field.y_position;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= clickRadius) {
        return i;
      }
    }

    return -1;
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    const coords = screenToPdfCoords(e.clientX, e.clientY);
    const fieldIndex = findFieldAtPosition(coords);

    if (fieldIndex !== -1) {
      setDragging(fieldIndex);
      setDragOffset({
        x: coords.x - fields[fieldIndex].x_position,
        y: coords.y - fields[fieldIndex].y_position
      });
      if (onFieldClick) onFieldClick(fieldIndex);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (dragging === null) return;

    const coords = screenToPdfCoords(e.clientX, e.clientY);
    if (!coords) return;

    const newX = Math.max(0, Math.min(pdfDimensions.width, coords.x - dragOffset.x));
    const newY = Math.max(0, Math.min(pdfDimensions.height, coords.y - dragOffset.y));

    if (onFieldDrag) {
      onFieldDrag(dragging, Math.round(newX), Math.round(newY));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleClick = (e) => {
    if (dragging !== null) return;

    const coords = screenToPdfCoords(e.clientX, e.clientY);
    const fieldIndex = findFieldAtPosition(coords);

    if (fieldIndex !== -1) {
      if (onFieldClick) onFieldClick(fieldIndex);
    } else if (coords && onClick) {
      onClick(coords.x, coords.y);
    }
  };

  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "red", textAlign: "center", padding: "2em" }}>
          <b>PDF Error:</b>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1f2937"
      }}
    >
      {/* Refresh button */}
      <button
        onClick={() => generatePreview(true)}
        disabled={isGenerating}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 20,
          padding: "8px 16px",
          backgroundColor: isGenerating ? "#4b5563" : "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: isGenerating ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        {isGenerating ? (
          <>
            <span style={{
              width: "14px",
              height: "14px",
              border: "2px solid #9ca3af",
              borderTop: "2px solid #fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              display: "inline-block"
            }} />
            Generating...
          </>
        ) : (
          <>🔄 Refresh Preview</>
        )}
      </button>
      
      {loading && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1f2937",
          zIndex: 10
        }}>
          <div style={{ textAlign: "center", color: "#9ca3af" }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid #374151",
              borderTop: "3px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 10px"
            }} />
            <div>Generating preview...</div>
          </div>
        </div>
      )}
      <div style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", display: "inline-block" }}>
        <canvas
          ref={pdfCanvasRef}
          style={{
            display: loading ? "none" : "block",
            maxWidth: "100%",
            maxHeight: "100%",
            backgroundColor: "#fff",
            boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
          }}
        />
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor: dragging !== null ? "grabbing" : "crosshair",
            touchAction: "none",
            pointerEvents: "auto",
            display: loading ? "none" : "block"
          }}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
};

export default PdfLivePreview;
