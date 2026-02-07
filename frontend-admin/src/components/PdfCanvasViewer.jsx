import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const PdfCanvasViewer = ({
  url,
  onClick,
  fields = [],
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
  const [fontLoaded, setFontLoaded] = useState(false);
  const scale = 1.5;

  // Load custom Arial font to match backend exactly
  useEffect(() => {
    const loadFont = async () => {
      try {
        const font = new FontFace('CertificateArial', 'url(/fonts/arial.ttf)');
        await font.load();
        document.fonts.add(font);
        setFontLoaded(true);
        console.log('Custom Arial font loaded successfully');
      } catch (err) {
        console.warn('Failed to load custom font, using system Arial:', err);
        setFontLoaded(true); // Continue with system font
      }
    };
    loadFont();
  }, []);

  // Load and render PDF to canvas
  useEffect(() => {
    if (!url) return;
    
    let isMounted = true;

    const loadPDF = async () => {
      // Wait for canvas to be ready
      let attempts = 0;
      while (!pdfCanvasRef.current && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      
      if (!pdfCanvasRef.current) {
        console.error("Canvas not available after waiting");
        setError("Canvas element not ready");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log("Loading PDF:", url);
        
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        
        if (!isMounted) return;
        
        const page = await pdf.getPage(1);
        
        if (!isMounted) return;

        // Get actual PDF dimensions at scale 1
        const viewport = page.getViewport({ scale: 1 });
        console.log("PDF dimensions:", viewport.width, "x", viewport.height);
        setPdfDimensions({ width: viewport.width, height: viewport.height });

        // Render at display scale
        const scaledViewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        
        if (!canvas) {
          console.error("Canvas lost during render");
          return;
        }

        const context = canvas.getContext("2d");
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        console.log("Rendering PDF at:", canvas.width, "x", canvas.height);

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;
        
        if (!isMounted) return;

        setLoading(false);
        console.log("PDF rendered successfully");
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
  }, [url, scale]);

  // Draw field markers on overlay canvas
  useEffect(() => {
    if (!overlayCanvasRef.current || !pdfCanvasRef.current) {
      return;
    }
    
    if (loading || !fontLoaded) {
      return;
    }

    const overlayCanvas = overlayCanvasRef.current;
    const pdfCanvas = pdfCanvasRef.current;

    // Match overlay canvas size exactly to PDF canvas
    overlayCanvas.width = pdfCanvas.width;
    overlayCanvas.height = pdfCanvas.height;

    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Draw field markers - coordinates are already in PDF space, just scale them
    fields.forEach((field, idx) => {
      const x = field.x_position * scale;
      const y = field.y_position * scale;
      const fontSize = (field.font_size || 12) * scale;
      const isSelected = idx === selectedFieldIndex;
      
      ctx.save();
      
      // Sample text for size reference
      const getSampleText = (fieldType) => {
        switch (fieldType) {
          case 'NAME': return 'John Doe';
          case 'COMPETITION': return 'Sample Competition';
          case 'CITY': return 'Mumbai';
          case 'DATE': return '15 Jan 2026';
          case 'RESULT': return 'WINNER';
          case 'POSITION': return '1st Position';
          case 'MI_ID': return 'MI12345';
          case 'CUSTOM': return 'Custom Text';
          default: return fieldType || 'Sample';
        }
      };
      const sampleText = getSampleText(field.field_type);
      
      // Use system Arial for preview
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.textBaseline = "middle";
      
      const textWidth = ctx.measureText(sampleText).width;
      
      // x_position is ALWAYS the LEFT starting point
      // Text ALWAYS starts at x, no offset for any alignment
      const boxX = x;
      
      // Draw text bounding box
      const boxHeight = fontSize;
      const boxY = y - boxHeight / 2;
      
      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(boxX, boxY, textWidth, boxHeight);
      
      ctx.strokeStyle = isSelected ? "rgba(59, 130, 246, 0.8)" : "rgba(239, 68, 68, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, textWidth, boxHeight);
      
      // Draw sample text starting at x position
      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.9)" : "rgba(80, 80, 80, 0.9)";
      ctx.textAlign = "left";
      ctx.fillText(sampleText, boxX, y);
      
      // Draw starting point marker (small vertical line)
      ctx.strokeStyle = isSelected ? "#3b82f6" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - fontSize * 0.6);
      ctx.lineTo(x, y + fontSize * 0.6);
      ctx.stroke();
      
      // Draw field type label
      const label = field.field_type || "Field";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      const labelWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.95)" : "rgba(239, 68, 68, 0.95)";
      ctx.fillRect(x, y - fontSize * 0.5 - 18, labelWidth + 8, 16);
      
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 4, y - fontSize * 0.5 - 10);
      
      ctx.restore();
    });
  }, [fields, selectedFieldIndex, scale, loading, fontLoaded]);
  
  // Convert screen coordinates to PDF coordinates
  const screenToPdfCoords = (clientX, clientY) => {
    const pdfCanvas = pdfCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!pdfCanvas || !overlayCanvas) return null;
    
    // Use overlayCanvas rect since that's where clicks happen
    const rect = overlayCanvas.getBoundingClientRect();
    
    // Get position relative to the overlay canvas display area
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    
    // The overlay canvas has internal pixel dimensions (overlayCanvas.width/height)
    // but is displayed at CSS dimensions (rect.width/height)
    // We need to convert from CSS coords to internal canvas coords first
    const canvasX = (displayX / rect.width) * overlayCanvas.width;
    const canvasY = (displayY / rect.height) * overlayCanvas.height;
    
    // Canvas coords are scaled by 'scale' factor from PDF coords
    // So divide by scale to get PDF coords
    const pdfX = canvasX / scale;
    const pdfY = canvasY / scale;
    
    console.log('screenToPdfCoords DETAILED:', {
      step1_click: { clientX, clientY },
      step2_relative: { displayX, displayY },
      step3_cssSize: { width: rect.width, height: rect.height },
      step4_canvasSize: { width: overlayCanvas.width, height: overlayCanvas.height },
      step5_canvasCoords: { x: canvasX, y: canvasY },
      step6_scale: scale,
      step7_pdfCoords: { x: pdfX, y: pdfY },
      expected_center: pdfDimensions.width / 2,
      diff_from_center: Math.abs(pdfX - pdfDimensions.width / 2)
    });
    
    return { x: Math.round(pdfX), y: Math.round(pdfY) };
  };

  // Check if coordinates are near a field or within its text area
  const findFieldAtPosition = (coords) => {
    if (!coords) return -1;
    
    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      const fontSize = field.font_size || 12;
      
      // Check if click is within the text bounding box area
      // Text starts at x_position and extends to the right
      // Approximate text width based on field type
      const approxTextWidth = fontSize * 6; // Rough estimate
      
      const inXRange = coords.x >= field.x_position - 10 && coords.x <= field.x_position + approxTextWidth;
      const inYRange = coords.y >= field.y_position - fontSize && coords.y <= field.y_position + fontSize;
      
      if (inXRange && inYRange) {
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
    console.log('PdfCanvasViewer click:', {
      clientX: e.clientX,
      clientY: e.clientY,
      pdfCoords: coords,
      pdfDimensions
    });
    const fieldIndex = findFieldAtPosition(coords);
    
    if (fieldIndex !== -1) {
      if (onFieldClick) onFieldClick(fieldIndex);
    } else if (coords && onClick) {
      onClick(coords.x, coords.y);
    }
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const coords = screenToPdfCoords(touch.clientX, touch.clientY);
    const fieldIndex = findFieldAtPosition(coords);
    
    if (fieldIndex !== -1) {
      setDragging(fieldIndex);
      setDragOffset({
        x: coords.x - fields[fieldIndex].x_position,
        y: coords.y - fields[fieldIndex].y_position
      });
      if (onFieldClick) onFieldClick(fieldIndex);
      e.preventDefault();
    } else if (coords && onClick) {
      onClick(coords.x, coords.y);
      e.preventDefault();
    }
  };

  const handleTouchMove = (e) => {
    if (dragging === null || !e.touches || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const coords = screenToPdfCoords(touch.clientX, touch.clientY);
    if (!coords) return;

    const newX = Math.max(0, Math.min(pdfDimensions.width, coords.x - dragOffset.x));
    const newY = Math.max(0, Math.min(pdfDimensions.height, coords.y - dragOffset.y));

    if (onFieldDrag) {
      onFieldDrag(dragging, Math.round(newX), Math.round(newY));
    }
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    setDragging(null);
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
            <div style={{ width: "40px", height: "40px", border: "3px solid #374151", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 10px" }} />
            <div>Loading PDF...</div>
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    </div>
  );
};

export default PdfCanvasViewer;
