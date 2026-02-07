import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { competitionsAPI, certificatesAPI, templatesAPI } from "../api";

const Competitions = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cities: [], // Array of { city_id, event_date }
  });
  const [submitting, setSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState("competition"); // 'competition' | 'city'

  // Add Branch modal state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchData, setBranchData] = useState({ city_id: "", event_date: "" });

  // Participants modal state
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);

  // Certificate generation modal state
  const [showCertModal, setShowCertModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [compRes, citiesRes] = await Promise.all([
        competitionsAPI.getAll(),
        competitionsAPI.getCities(),
      ]);
      setCompetitions(compRes.data.data);
      setCities(citiesRes.data.data);
    } catch (error) {
      console.error("Failed to load:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Create competition without cities - cities added separately via Add Branch
      await competitionsAPI.create({
        name: formData.name,
        description: formData.description,
      });
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (compId, newStatus) => {
    try {
      await competitionsAPI.updateStatus(compId, newStatus);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Status update failed");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this competition? This action cannot be undone."))
      return;

    try {
      await competitionsAPI.delete(id);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Delete failed");
    }
  };

  const viewParticipants = async (comp) => {
    setSelectedComp(comp);
    setShowParticipants(true);
    setParticipantsLoading(true);
    try {
      const response = await competitionsAPI.getParticipants(comp.id);
      setParticipants(response.data.data);
    } catch (error) {
      console.error("Failed to load participants:", error);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      let cityId = branchData.city_id;
      
      // If creating a new city, create it first
      if (branchData.city_id === '__new__') {
        if (!branchData.new_city_name?.trim()) {
          alert('Please enter a city name');
          return;
        }
        const cityRes = await competitionsAPI.createCity(branchData.new_city_name.trim());
        cityId = cityRes.data.data.id;
      }
      
      // Convert empty event_date to null for proper optional handling
      const data = {
        city_id: cityId,
        event_date: branchData.event_date || null
      };
      await competitionsAPI.addCity(selectedComp.id, data);
      setShowBranchModal(false);
      setBranchData({ city_id: "", event_date: "", new_city_name: "" });
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to add branch");
    }
  };

  const openAddBranch = (comp) => {
    setSelectedComp(comp);
    setBranchData({ city_id: "", event_date: "" });
    setShowBranchModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      cities: [],
    });
  };

  const toggleCity = (cityId) => {
    setFormData((prev) => {
      const existingIndex = prev.cities.findIndex((c) => c.city_id === cityId);
      if (existingIndex >= 0) {
        // Remove city
        return {
          ...prev,
          cities: prev.cities.filter((c) => c.city_id !== cityId),
        };
      } else {
        // Add city with null date initially
        return {
          ...prev,
          cities: [...prev.cities, { city_id: cityId, event_date: null }],
        };
      }
    });
  };

  const updateCityDate = (cityId, date) => {
    setFormData((prev) => ({
      ...prev,
      cities: prev.cities.map((c) =>
        c.city_id === cityId ? { ...c, event_date: date || null } : c
      ),
    }));
  };

  const isCitySelected = (cityId) => {
    return formData.cities.some((c) => c.city_id === cityId);
  };

  const openCertificateGeneration = async (comp) => {
    setSelectedComp(comp);
    setSelectedTemplate("");
    setSelectedCity("");
    setShowCertModal(true);

    // Load templates
    try {
      const response = await templatesAPI.getAll({ status: "ACTIVE" });
      const allTemplates = response.data.templates || [];

      // Filter to only show templates with fields configured
      const templatesWithFields = allTemplates.filter(
        (t) => t.field_count && t.field_count > 0
      );
      setTemplates(templatesWithFields);

      console.log("Available templates:", templatesWithFields);

      // Auto-select if template is linked to this competition
      const linkedTemplate = templatesWithFields.find(
        (t) => t.competition_id === comp.id
      );
      if (linkedTemplate) {
        setSelectedTemplate(linkedTemplate.id.toString());
      } else if (templatesWithFields.length === 1) {
        // Auto-select if only one template available
        setSelectedTemplate(templatesWithFields[0].id.toString());
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      alert("Failed to load templates: " + error.message);
    }
  };

  const handleGenerateCertificates = async (e) => {
    e.preventDefault();

    if (!selectedTemplate) {
      alert("Please select a template");
      return;
    }

    const confirmMsg = selectedCity
      ? `Generate certificates for ${selectedComp.name} in ${
          cities.find((c) => c.id === parseInt(selectedCity))?.name
        }?`
      : `Generate certificates for ALL participants in ${selectedComp.name}?`;

    if (!confirm(confirmMsg)) return;

    setGenerating(true);
    try {
      const response = await certificatesAPI.generateForCompetition({
        competition_id: selectedComp.id,
        city_id: selectedCity || null,
        template_id: parseInt(selectedTemplate),
      });

      const results = response.data.results;
      alert(
        `✅ Generated ${results.success.length} certificates!\n${
          results.failed.length > 0 ? `⚠️ Failed: ${results.failed.length}` : ""
        }`
      );

      setShowCertModal(false);
      navigate("/certificates");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to generate certificates");
    } finally {
      setGenerating(false);
    }
  };

  const getCityDate = (cityId) => {
    const city = formData.cities.find((c) => c.city_id === cityId);
    return city?.event_date || "";
  };

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-warning",
      ACTIVE: "badge-success",
      COMPLETED: "badge-info",
      CANCELLED: "badge-error",
      ARCHIVED: "badge-secondary",
    };
    return badges[status] || "badge-secondary";
  };

  const getStatusLabel = (status) => {
    const labels = {
      DRAFT: "Draft",
      ACTIVE: "Ongoing",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
      ARCHIVED: "Archived",
    };
    return labels[status] || status;
  };

  const getRegistrationBadge = (isOpen) => {
    return isOpen ? "badge-success" : "badge-error";
  };

  const getRegistrationLabel = (isOpen) => {
    return isOpen ? "Reg. Open" : "Reg. Closed";
  };

  const handleToggleRegistration = async (compId, currentState) => {
    try {
      await competitionsAPI.toggleRegistration(compId, !currentState);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to toggle registration");
    }
  };

  const getNextActions = (status, registrationOpen) => {
    const actions = [];
    
    // Status actions based on current status
    if (status === "DRAFT") {
      actions.push({
        label: "Start Competition",
        action: () => handleStatusChange(null, "ACTIVE"),
        type: "status",
        status: "ACTIVE",
        color: "bg-emerald-600 hover:bg-emerald-700",
      });
    } else if (status === "ACTIVE") {
      actions.push({
        label: "Complete",
        action: () => handleStatusChange(null, "COMPLETED"),
        type: "status",
        status: "COMPLETED",
        color: "bg-blue-600 hover:bg-blue-700",
      });
    }
    
    // Registration toggle (only for DRAFT or ACTIVE)
    if (["DRAFT", "ACTIVE"].includes(status)) {
      actions.push({
        label: registrationOpen ? "Close Registration" : "Open Registration",
        action: () => {},
        type: "registration",
        registrationOpen: !registrationOpen,
        color: registrationOpen 
          ? "bg-yellow-600 hover:bg-yellow-700" 
          : "bg-emerald-600 hover:bg-emerald-700",
      });
    }
    
    return actions;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Competitions</h1>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-admin whitespace-nowrap"
          >
            + New Competition
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <button
          onClick={() => setViewMode("competition")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            viewMode === "competition"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          By Competition
        </button>
        <button
          onClick={() => setViewMode("city")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            viewMode === "city"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          By City
        </button>
      </div>

      {/* Competitions List */}
      <div className="grid gap-4">
        {viewMode === "competition"
          ? // COMPETITION VIEW
            competitions.map((comp) => (
              <div key={comp.id} className="admin-card p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-white break-words">
                        {comp.name}
                      </h3>
                      <span className={`badge ${getStatusBadge(comp.status)}`}>
                        {getStatusLabel(comp.status)}
                      </span>
                      <span className={`badge ${getRegistrationBadge(comp.registration_open)}`}>
                        {getRegistrationLabel(comp.registration_open)}
                      </span>
                    </div>
                    {comp.description && (
                      <p className="text-gray-400 text-xs sm:text-sm mb-3 break-words">
                        {comp.description}
                      </p>
                    )}

                    {/* Branches (Cities) */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                      {comp.cities?.map((city) => (
                        <div
                          key={city.city_id}
                          className="bg-gray-700/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm border border-gray-600"
                        >
                          <span className="text-white font-medium">
                            {city.city_name}
                          </span>
                          {city.event_date && (
                            <span className="text-gray-400 ml-1.5 sm:ml-2 border-l border-gray-600 pl-1.5 sm:pl-2 hidden sm:inline">
                              📅 {formatDate(city.event_date)}
                            </span>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => openAddBranch(comp)}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm border border-dashed border-gray-500 text-gray-400 hover:text-white hover:border-gray-400 transition-colors whitespace-nowrap"
                      >
                        + Branch
                      </button>
                    </div>

                    <button
                      onClick={() => viewParticipants(comp)}
                      className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      {comp.participant_count || 0} participants →
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-col gap-2 lg:items-end">
                    <button
                      onClick={() =>
                        navigate(`/competitions/${comp.id}/dashboard`)
                      }
                      className="px-2 sm:px-3 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 text-xs border border-indigo-400/30 hover:border-indigo-400 whitespace-nowrap"
                    >
                      📊 Dashboard
                    </button>
                    <button
                      onClick={() =>
                        navigate(`/competitions/${comp.id}/rounds`)
                      }
                      className="px-2 sm:px-3 py-1.5 rounded-lg text-purple-400 hover:text-purple-300 text-xs border border-purple-400/30 hover:border-purple-400 whitespace-nowrap"
                    >
                      🎯 Rounds
                    </button>
                    {comp.status !== "DRAFT" && comp.status !== "CANCELLED" && (
                      <button
                        onClick={() => openCertificateGeneration(comp)}
                        className="px-2 sm:px-3 py-1.5 rounded-lg text-green-400 hover:text-green-300 text-xs border border-green-400/30 hover:border-green-400 whitespace-nowrap"
                      >
                        📜 Certificates
                      </button>
                    )}
                    {getNextActions(comp.status, comp.registration_open).map((action, idx) => (
                      <button
                        key={`${action.type}-${idx}`}
                        onClick={() => {
                          if (action.type === "status") {
                            handleStatusChange(comp.id, action.status);
                          } else if (action.type === "registration") {
                            handleToggleRegistration(comp.id, comp.registration_open);
                          }
                        }}
                        className={`px-2 sm:px-3 py-1.5 rounded-lg text-white text-xs whitespace-nowrap ${action.color}`}
                      >
                        {action.label}
                      </button>
                    ))}
                    {isAdmin && comp.status === "DRAFT" && (
                      <button
                        onClick={() => handleDelete(comp.id)}
                        className="px-3 py-1.5 rounded-lg text-red-400 hover:text-red-300 text-sm border border-red-400/30 hover:border-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          : // CITY VIEW
            cities.map((city) => {
              const cityComps = competitions.filter((c) =>
                c.cities?.some((cc) => cc.city_id === city.id)
              );
              if (cityComps.length === 0) return null;

              return (
                <div key={city.id} className="admin-card p-5">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    📍 {city.name}
                    <span className="text-sm font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                      {cityComps.length} competitions
                    </span>
                  </h3>
                  <div className="space-y-3 pl-4 border-l-2 border-gray-700">
                    {cityComps.map((comp) => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between group"
                      >
                        <div>
                          <span className="text-lg text-white font-medium">
                            {comp.name}
                          </span>
                          <div className="text-sm text-gray-400">
                            Status: {getStatusLabel(comp.status)}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            navigate(`/competitions/${comp.id}/rounds`)
                          }
                          className="px-3 py-1 rounded bg-gray-700 text-sm text-gray-300 hover:bg-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Manage
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

        {competitions.length === 0 && (
          <div className="admin-card p-8 text-center text-gray-500">
            No competitions yet. Click "+ New Competition" to create one.
          </div>
        )}
      </div>

      {/* Create Competition Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content p-6 max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white mb-4">
              Create Competition
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Competition Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input-admin"
                  placeholder="e.g., Mi Idol Season 3"
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input-admin h-20 resize-none"
                  placeholder="Brief description of the competition"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-400">
                  ℹ️ Cities will be added after creation using the "+ Add
                  Branch" button
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="btn-admin"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Competition"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipants && (
        <div
          className="modal-overlay"
          onClick={() => setShowParticipants(false)}
        >
          <div
            className="modal-content p-6 max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                Participants - {selectedComp?.name}
              </h2>
              <button
                onClick={() => setShowParticipants(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {participantsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : participants.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No participants yet
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>MI ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>City</th>
                      <th>Event Date</th>
                      <th>Registered At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium text-blue-400">
                          {p.mi_id || '-'}
                        </td>
                        <td className="font-medium text-white">
                          {p.full_name}
                        </td>
                        <td className="text-gray-400">{p.email}</td>
                        <td className="text-gray-400">{p.city_name}</td>
                        <td className="text-gray-400">
                          {formatDate(p.event_date)}
                        </td>
                        <td className="text-gray-400">
                          {formatDate(p.registered_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-sm">
              <span className="text-gray-500">
                Total: {participants.length} participants
              </span>
              <button
                onClick={() => setShowParticipants(false)}
                className="btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showBranchModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowBranchModal(false)}
        >
          <div
            className="modal-content p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                Add City Branch - {selectedComp?.name}
              </h2>
              <button
                onClick={() => setShowBranchModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBranch}>
              <div className="form-group">
                <label>City</label>
                <select
                  value={branchData.city_id}
                  onChange={(e) =>
                    setBranchData({ ...branchData, city_id: e.target.value, new_city_name: '' })
                  }
                  required={!branchData.new_city_name}
                  className="form-input"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>Select City</option>
                  {cities
                    .filter(
                      (city) =>
                        !selectedComp?.cities?.some(
                          (c) => c.city_id === city.id
                        )
                    )
                    .map((city) => (
                      <option key={city.id} value={city.id} style={{ background: '#1a1a1a', color: '#fff' }}>
                        {city.name}
                      </option>
                    ))}
                  <option value="__new__" style={{ background: '#1a1a1a', color: '#fff' }}>➕ Create New City...</option>
                </select>
              </div>

              {branchData.city_id === '__new__' && (
                <div className="form-group">
                  <label>New City Name</label>
                  <input
                    type="text"
                    value={branchData.new_city_name || ''}
                    onChange={(e) =>
                      setBranchData({ ...branchData, new_city_name: e.target.value })
                    }
                    className="form-input"
                    placeholder="e.g., IIT Bombay - Grand Finals"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    💡 Use this for Grand Finals or special event locations
                  </p>
                </div>
              )}

              <div className="form-group">
                <label>Event Date (Optional)</label>
                <input
                  type="date"
                  value={branchData.event_date}
                  onChange={(e) =>
                    setBranchData({ ...branchData, event_date: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-admin">
                  Add City
                </button>
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Certificate Generation Modal */}
      {showCertModal && (
        <div className="modal-overlay" onClick={() => setShowCertModal(false)}>
          <div
            className="modal-content p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                📜 Generate Certificates - {selectedComp?.name}
              </h2>
              <button
                onClick={() => setShowCertModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateCertificates}>
              <div className="form-group">
                <label className="text-white mb-2 block">
                  Certificate Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  required
                  className="form-input w-full"
                >
                  <option value="">Select Template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.field_count} fields)
                      {t.competition_id === selectedComp?.id ? " ✓ Linked" : ""}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-sm text-yellow-400 mt-1">
                    ⚠️ No templates with fields configured.
                    <br />
                    Go to Templates page → Edit template → Configure fields
                    (drag on PDF).
                  </p>
                )}
                {templates.length > 0 &&
                  !templates.some((t) => t.field_count > 0) && (
                    <p className="text-sm text-yellow-400 mt-1">
                      ⚠️ Templates found but no fields configured. Add fields
                      first.
                    </p>
                  )}
              </div>

              <div className="form-group">
                <label className="text-white mb-2 block">City (Optional)</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="form-input w-full"
                >
                  <option value="">All Cities</option>
                  {selectedComp?.cities?.map((cc) => {
                    const city = cities.find((c) => c.id === cc.city_id);
                    return (
                      <option key={cc.city_id} value={cc.city_id}>
                        {city?.name}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Leave as "All Cities" to generate for all participants
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={generating}
                  className="btn-admin flex-1"
                >
                  {generating ? "Generating..." : "📜 Generate Certificates"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="btn-outline"
                  disabled={generating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Competitions;
