import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { templatesAPI, competitionsAPI } from "../api";
import PdfViewer from "../components/PdfViewer";
import PdfCanvasViewer from "../components/PdfCanvasViewer";

const FIELD_TYPES = [
  { value: "NAME", label: "Participant Name", color: "#3b82f6" },
  { value: "COMPETITION", label: "Competition Name", color: "#10b981" },
  { value: "CITY", label: "City", color: "#f59e0b" },
  { value: "DATE", label: "Date", color: "#8b5cf6" },
  { value: "RESULT", label: "Result / Position", color: "#ef4444" },
  { value: "BENEFACTORS", label: "Benefactors", color: "#ec4899" },
];

const TemplateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [template, setTemplate] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [templateImage, setTemplateImage] = useState(null);
  const [templateDimensions, setTemplateDimensions] = useState({
    width: 842,
    height: 595,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  // Listen for sidebar state changes
  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(localStorage.getItem('sidebarCollapsed') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check periodically for same-tab changes
    const interval = setInterval(() => {
      const current = localStorage.getItem('sidebarCollapsed') === 'true';
      if (current !== sidebarCollapsed) {
        setSidebarCollapsed(current);
      }
    }, 500);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [sidebarCollapsed]);

  // Field editing state
  const [pendingFields, setPendingFields] = useState([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [activeFieldType, setActiveFieldType] = useState("NAME");
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Competition linking
  const [selectedCompetition, setSelectedCompetition] = useState("");
  const [linkingCompetition, setLinkingCompetition] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  // Keyboard navigation for selected field
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedFieldIndex === null || !showVisualEditor) return;

      const step = e.shiftKey ? 10 : 1; // Shift for larger steps
      let moved = false;

      setPendingFields((prev) => {
        const updated = [...prev];
        const field = { ...updated[selectedFieldIndex] };

        switch (e.key) {
          case "ArrowUp":
            field.y_position = Math.max(0, field.y_position - step);
            moved = true;
            break;
          case "ArrowDown":
            field.y_position = Math.min(
              templateDimensions.height,
              field.y_position + step
            );
            moved = true;
            break;
          case "ArrowLeft":
            field.x_position = Math.max(0, field.x_position - step);
            moved = true;
            break;
          case "ArrowRight":
            field.x_position = Math.min(
              templateDimensions.width,
              field.x_position + step
            );
            moved = true;
            break;
          case "Delete":
          case "Backspace":
            updated.splice(selectedFieldIndex, 1);
            setSelectedFieldIndex(null);
            return updated;
        }

        if (moved) {
          e.preventDefault();
          updated[selectedFieldIndex] = field;
        }
        return updated;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFieldIndex, showVisualEditor, templateDimensions]);

  const loadData = async () => {
    try {
      const [templateRes, compsRes] = await Promise.all([
        templatesAPI.getById(id),
        competitionsAPI.getAll(),
      ]);

      // Backend returns { success: true, template } not { data: { data } }
      const templateData =
        templateRes?.data?.template || templateRes?.data?.data;
      const competitionsData = compsRes?.data?.data;

      if (!templateData) {
        console.error("Template response:", templateRes?.data);
        throw new Error("Template data not found");
      }

      setTemplate(templateData);
      setCompetitions(competitionsData || []);
      setSelectedCompetition(templateData.competition_id || "");

      // Load fields if they exist
      console.log("Template loaded:", templateData.name, "Fields count:", templateData.fields?.length || 0);
      if (templateData.fields && templateData.fields.length > 0) {
        console.log("Loading existing fields:", templateData.fields);
        setPendingFields(templateData.fields);
      } else {
        console.log("No existing fields found");
        setPendingFields([]);
      }
    } catch (error) {
      console.error("Failed to load:", error);
      alert("Template not found");
      navigate("/templates");
    } finally {
      setLoading(false);
    }
  };

  // Load template preview when visual editor is opened
  useEffect(() => {
    if (showVisualEditor && template) {
      console.log("Visual editor opened. Current pendingFields:", pendingFields.length);
      loadTemplatePreview();
      // Ensure fields are loaded in visual editor
      if (template.fields && template.fields.length > 0 && pendingFields.length === 0) {
        console.log("Visual editor opened - reloading fields:", template.fields.length);
        setPendingFields([...template.fields]);
      }
    }
  }, [showVisualEditor, template]);

  const loadTemplatePreview = async () => {
    if (!template) return;

    try {
      const API_BASE =
        import.meta.env.VITE_API_URL?.replace("/api", "") ||
        "http://localhost:3002";

      // For PDF files, fetch with authentication and create blob URL
      if (template.file_type === "PDF") {
        try {
          console.log("TemplateDetail: Fetching PDF for template ID:", id);
          const response = await templatesAPI.getPDF(id);
          console.log(
            "TemplateDetail: PDF response received, size:",
            response.data.size,
            "type:",
            response.data.type
          );
          const blob = new Blob([response.data], { type: "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          console.log("TemplateDetail: Blob URL created:", blobUrl);
          setTemplateImage(blobUrl);
          setTemplateDimensions({
            width: template.page_width || 842,
            height: template.page_height || 595,
          });
          return;
        } catch (pdfError) {
          console.error(
            "Failed to load PDF with auth, trying static path:",
            pdfError
          );
          // Fallback to static path without auth
          let filePath = template.file_path;
          if (filePath.includes("uploads")) {
            const uploadsIndex = filePath.lastIndexOf("uploads");
            filePath =
              "/" + filePath.substring(uploadsIndex).replace(/\\/g, "/");
          }
          console.log(
            "TemplateDetail: Trying static path:",
            `${API_BASE}${filePath}`
          );
          setTemplateImage(`${API_BASE}${filePath}`);
          setTemplateDimensions({
            width: template.page_width || 842,
            height: template.page_height || 595,
          });
          return;
        }
      }

      // For non-PDF files, use preview-image endpoint
      const response = await templatesAPI.getPreviewImage(id);
      const data = response.data.data;

      if (data.base64) {
        // PNG preview from backend
        setTemplateImage(`data:image/png;base64,${data.base64}`);
        setTemplateDimensions({ width: data.width, height: data.height });
      } else if (data.file_path) {
        // Direct file URL (SVG, image)
        const fileUrl = `${API_BASE}${data.file_path}`;
        setTemplateImage(fileUrl);
        setTemplateDimensions({
          width: data.width || template.page_width || 842,
          height: data.height || template.page_height || 595,
        });
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
      const API_BASE =
        import.meta.env.VITE_API_URL?.replace("/api", "") ||
        "http://localhost:3002";

      // Fallback for PDF
      if (template.file_type === "PDF") {
        let filePath = template.file_path;
        if (filePath.includes("uploads")) {
          const uploadsIndex = filePath.lastIndexOf("uploads");
          filePath = "/" + filePath.substring(uploadsIndex).replace(/\\/g, "/");
        }
        setTemplateImage(`${API_BASE}${filePath}`);
      } else {
        // Fallback to direct file path for images
        let filePath = template.file_path;
        if (filePath.includes("uploads")) {
          const uploadsIndex = filePath.lastIndexOf("uploads");
          filePath = "/" + filePath.substring(uploadsIndex).replace(/\\/g, "/");
        } else if (!filePath.startsWith("/")) {
          filePath = "/uploads/" + filePath.split(/[/\\]/).pop();
        }
        setTemplateImage(`${API_BASE}${filePath}`);
      }

      setTemplateDimensions({
        width: template.page_width || 842,
        height: template.page_height || 595,
      });
    }
  };

  const handleCanvasClick = (e) => {
    if (isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = templateDimensions.width / rect.width;
    const scaleY = templateDimensions.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    // Check if clicking on an existing field
    const clickedFieldIndex = pendingFields.findIndex((field) => {
      const fieldX = field.x_position;
      const fieldY = field.y_position;
      const threshold = 30; // Click threshold
      return (
        Math.abs(x - fieldX) < threshold && Math.abs(y - fieldY) < threshold
      );
    });

    if (clickedFieldIndex !== -1) {
      setSelectedFieldIndex(clickedFieldIndex);
    } else {
      // Add new field at clicked position
      const newField = {
        field_type: activeFieldType,
        x_position: x,
        y_position: y,
        font_size: 20,
        font_family: "Helvetica",
        font_color: getFieldColor(activeFieldType),
        text_align: "CENTER",
      };
      setPendingFields([...pendingFields, newField]);
      setSelectedFieldIndex(pendingFields.length); // Select the new field
    }
  };

  const handleFieldMouseDown = (e, index) => {
    e.stopPropagation();
    setSelectedFieldIndex(index);
    setIsDragging(true);

    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const scaleX = templateDimensions.width / rect.width;
    const scaleY = templateDimensions.height / rect.height;

    setDragOffset({
      x: (e.clientX - rect.left) * scaleX - pendingFields[index].x_position,
      y: (e.clientY - rect.top) * scaleY - pendingFields[index].y_position,
    });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || selectedFieldIndex === null) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = templateDimensions.width / rect.width;
      const scaleY = templateDimensions.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX - dragOffset.x);
      const y = Math.round((e.clientY - rect.top) * scaleY - dragOffset.y);

      setPendingFields((prev) => {
        const updated = [...prev];
        updated[selectedFieldIndex] = {
          ...updated[selectedFieldIndex],
          x_position: Math.max(0, Math.min(templateDimensions.width, x)),
          y_position: Math.max(0, Math.min(templateDimensions.height, y)),
        };
        return updated;
      });
    },
    [isDragging, selectedFieldIndex, dragOffset, templateDimensions]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleTouchStart = (e, index) => {
    e.stopPropagation();
    setSelectedFieldIndex(index);
    setIsDragging(true);

    const touch = e.touches[0];
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const scaleX = templateDimensions.width / rect.width;
    const scaleY = templateDimensions.height / rect.height;

    setDragOffset({
      x: (touch.clientX - rect.left) * scaleX - pendingFields[index].x_position,
      y: (touch.clientY - rect.top) * scaleY - pendingFields[index].y_position,
    });
  };

  const handleTouchMove = useCallback(
    (e) => {
      if (!isDragging || selectedFieldIndex === null) return;

      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = templateDimensions.width / rect.width;
      const scaleY = templateDimensions.height / rect.height;

      const x = Math.round((touch.clientX - rect.left) * scaleX - dragOffset.x);
      const y = Math.round((touch.clientY - rect.top) * scaleY - dragOffset.y);

      setPendingFields((prev) => {
        const updated = [...prev];
        updated[selectedFieldIndex] = {
          ...updated[selectedFieldIndex],
          x_position: Math.max(0, Math.min(templateDimensions.width, x)),
          y_position: Math.max(0, Math.min(templateDimensions.height, y)),
        };
        return updated;
      });
    },
    [isDragging, selectedFieldIndex, dragOffset, templateDimensions]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
      return () => {
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  const getFieldColor = (fieldType) => {
    return FIELD_TYPES.find((f) => f.value === fieldType)?.color || "#3b82f6";
  };

  const handleRemoveField = (index) => {
    setPendingFields((prev) => prev.filter((_, i) => i !== index));
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(null);
    } else if (selectedFieldIndex > index) {
      setSelectedFieldIndex(selectedFieldIndex - 1);
    }
  };

  const handleSaveFields = async () => {
    if (pendingFields.length === 0) {
      alert(
        "No fields to save. Add at least one field by clicking on the template."
      );
      return;
    }

    setSubmitting(true);
    try {
      // Delete existing fields first
      if (template.fields && template.fields.length > 0) {
        for (const field of template.fields) {
          await templatesAPI.deleteField(field.id);
        }
      }

      // Save all pending fields
      for (const field of pendingFields) {
        await templatesAPI.addField(id, field);
      }

      setPendingFields([]);
      setShowVisualEditor(false);
      setSelectedFieldIndex(null);
      loadData();
      alert(`Successfully saved ${pendingFields.length} field(s)!`);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save fields");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkCompetition = async () => {
    if (!selectedCompetition) {
      alert("Please select a competition");
      return;
    }

    setLinkingCompetition(true);
    try {
      await templatesAPI.linkToCompetition(id, selectedCompetition);
      loadData();
      alert("Template linked to competition!");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to link template");
    } finally {
      setLinkingCompetition(false);
    }
  };

  const openVisualEditor = () => {
    // Load existing fields into pending
    if (template.fields && template.fields.length > 0) {
      setPendingFields(
        template.fields.map((f) => ({
          field_type: f.field_type,
          x_position: f.x_position,
          y_position: f.y_position,
          font_size: f.font_size,
          font_family: f.font_family,
          font_color: f.font_color,
          text_align: f.text_align?.toUpperCase() || "CENTER",
        }))
      );
    } else {
      setPendingFields([]);
    }
    setSelectedFieldIndex(null);
    setShowVisualEditor(true);
    loadTemplatePreview();
  };

  const handleDeleteField = async (fieldId) => {
    if (!confirm("Delete this field?")) return;
    try {
      await templatesAPI.deleteField(fieldId);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete field");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-gray-400">Template not found</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/templates")}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">{template.name}</h1>
        <span
          className={`badge ${
            template.fields?.length > 0 ? "badge-info" : "badge-warning"
          }`}
        >
          {template.fields?.length > 0 ? "DYNAMIC" : "STATIC"}
        </span>
      </div>

      {/* Template Info */}
      <div className="admin-card p-6 mb-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Dimensions:</span>
            <span className="text-white ml-2">
              {template.page_width} × {template.page_height}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Orientation:</span>
            <span className="text-white ml-2">{template.orientation}</span>
          </div>
          <div>
            <span className="text-gray-400">Fields:</span>
            <span className="text-white ml-2">
              {template.fields?.length || 0}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Created:</span>
            <span className="text-white ml-2">
              {new Date(template.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Competition Linking */}
      <div className="admin-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          📎 Link to Competition
        </h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">
              Competition
            </label>
            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className="input-admin w-full"
            >
              <option value="">Select competition...</option>
              {competitions.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleLinkCompetition}
            disabled={linkingCompetition || !selectedCompetition}
            className="btn-admin whitespace-nowrap"
          >
            {linkingCompetition ? "Linking..." : "Link Template"}
          </button>
        </div>
        {template.competition_id && (
          <p className="text-sm text-green-400 mt-2">
            ✓ Currently linked to:{" "}
            {competitions.find((c) => c.id === template.competition_id)?.name ||
              "Unknown"}
          </p>
        )}
      </div>

      {/* Fields Section */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            📍 Template Fields
          </h2>
          <div className="flex gap-2">
            <button onClick={openVisualEditor} className="btn-admin">
              ✏️ Add/Edit Fields
            </button>
          </div>
        </div>

        {template.fields && template.fields.length > 0 ? (
          <div className="space-y-3">
            {template.fields.map((field) => (
              <div
                key={field.id}
                className="admin-card p-4 flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: getFieldColor(field.field_type),
                      }}
                    />
                    <h3 className="font-semibold text-white">
                      {field.field_type}
                    </h3>
                    <span className="text-xs text-gray-400">
                      Position: ({field.x}, {field.y})
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Font: {field.font_family} - {field.font_size}px | Color:{" "}
                    {field.font_color} | Align: {field.alignment}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteField(field.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No fields configured yet.</p>
            <button
              onClick={openVisualEditor}
              className="btn-primary"
            >
              ✏️ Add Fields Manually
            </button>
          </div>
        )}
      </div>

      {/* Visual Field Editor Modal */}
      {showVisualEditor && (
        <div className={`fixed inset-0 bg-black/90 backdrop-blur-sm flex items-stretch z-50 visual-editor-modal ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
          <div className="flex flex-col lg:flex-row w-full h-full">
            {/* Sidebar */}
            <div className="w-full lg:w-80 bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-700 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  📍 Field Editor
                </h2>
                <button
                  onClick={() => setShowVisualEditor(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs text-gray-300">
                <p className="mb-1">
                  📌 <strong>Click</strong> on template to add field
                </p>
                <p className="mb-1">
                  🖱️ <strong>Drag</strong> fields to reposition
                </p>
                <p className="mb-1">
                  ⌨️ <strong>Arrow keys</strong> for fine adjustment
                </p>
                <p>
                  🗑️ <strong>Delete/Backspace</strong> to remove selected
                </p>
              </div>

              {/* Field Type Selector */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Add Field Type
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {FIELD_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setActiveFieldType(type.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all ${
                        activeFieldType === type.value
                          ? "bg-gray-700 border-blue-500 text-white"
                          : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pending Fields List */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white mb-2">
                  Fields ({pendingFields.length})
                </h3>
                {pendingFields.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Click on template to add fields
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {pendingFields.map((field, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedFieldIndex(idx)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                          selectedFieldIndex === idx
                            ? "bg-blue-600/30 border border-blue-500"
                            : "bg-gray-800/50 border border-transparent hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: getFieldColor(field.field_type),
                            }}
                          />
                          <div>
                            <div className="text-sm text-white">
                              {field.field_type}
                            </div>
                            <div className="text-xs text-gray-500">
                              ({field.x_position}, {field.y_position})
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveField(idx);
                          }}
                          className="text-red-400 hover:text-red-300 px-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Field Properties */}
              {selectedFieldIndex !== null &&
                pendingFields[selectedFieldIndex] && (
                  <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                    <h3 className="text-sm font-semibold text-white mb-2">
                      Selected Field
                    </h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400">X</label>
                          <input
                            type="number"
                            value={pendingFields[selectedFieldIndex].x_position}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setPendingFields((prev) => {
                                const updated = [...prev];
                                updated[selectedFieldIndex] = {
                                  ...updated[selectedFieldIndex],
                                  x_position: val,
                                };
                                return updated;
                              });
                            }}
                            className="input-admin w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Y</label>
                          <input
                            type="number"
                            value={pendingFields[selectedFieldIndex].y_position}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setPendingFields((prev) => {
                                const updated = [...prev];
                                updated[selectedFieldIndex] = {
                                  ...updated[selectedFieldIndex],
                                  y_position: val,
                                };
                                return updated;
                              });
                            }}
                            className="input-admin w-full text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">
                          Font Size
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="48"
                          value={pendingFields[selectedFieldIndex].font_size}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setPendingFields((prev) => {
                              const updated = [...prev];
                              updated[selectedFieldIndex] = {
                                ...updated[selectedFieldIndex],
                                font_size: val,
                              };
                              return updated;
                            });
                          }}
                          className="w-full"
                        />
                        <div className="text-center text-xs text-white">
                          {pendingFields[selectedFieldIndex].font_size}px
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleSaveFields}
                  disabled={submitting || pendingFields.length === 0}
                  className="btn-primary w-full"
                >
                  {submitting
                    ? "Saving..."
                    : `💾 Save ${pendingFields.length} Field(s)`}
                </button>
                <button
                  onClick={() => {
                    setShowVisualEditor(false);
                    setPendingFields([]);
                    setSelectedFieldIndex(null);
                  }}
                  className="btn-outline w-full"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 p-4 overflow-auto bg-gray-950 flex items-center justify-center">
              <div
                className="relative cursor-crosshair select-none"
                style={{ maxWidth: "100%", maxHeight: "100%" }}
              >
                {template?.file_path?.toLowerCase().endsWith(".pdf") ? (
                  <PdfCanvasViewer
                    url={templateImage}
                    fields={pendingFields}
                    selectedFieldIndex={selectedFieldIndex}
                    onFieldClick={(index) => {
                      setSelectedFieldIndex(index);
                    }}
                    onFieldDrag={(index, x, y) => {
                      setPendingFields((prev) => {
                        const updated = [...prev];
                        updated[index] = {
                          ...updated[index],
                          x_position: x,
                          y_position: y,
                        };
                        return updated;
                      });
                    }}
                    onClick={(x, y) => {
                      // Add new field at clicked position
                      setPendingFields((prev) => [
                        ...prev,
                        {
                          field_type: activeFieldType,
                          x_position: Math.round(x),
                          y_position: Math.round(y),
                          font_size: 20,
                          font_family: "Helvetica",
                          font_color: "#000000",
                          text_align: "CENTER",
                        },
                      ]);
                    }}
                  />
                ) : (
                  <img
                    src={templateImage}
                    alt="Template"
                    className="max-w-full h-auto border-2 border-gray-700 shadow-2xl"
                    style={{ maxHeight: "calc(100vh - 120px)" }}
                    draggable={false}
                    onLoad={(e) => {
                      // Update dimensions based on rendered size
                      const img = e.target;
                      const rect = img.getBoundingClientRect();
                      console.log(
                        "Image loaded - Natural:",
                        img.naturalWidth,
                        "x",
                        img.naturalHeight,
                        "Displayed:",
                        rect.width,
                        "x",
                        rect.height
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateDetail;
