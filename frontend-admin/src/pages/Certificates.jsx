import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { certificatesAPI, competitionsAPI, templatesAPI, roundsAPI } from "../api";
import PdfPreview from "../components/PdfPreview";

/**
 * Certificates Management Page
 *
 * Purpose: Manage generated certificates (NOT templates!)
 * - View all generated certificates
 * - Preview certificates before releasing
 * - Release certificates to users
 * - Bulk release operations
 *
 * This is different from the Templates page which manages certificate templates.
 * This page shows actual generated certificates that are ready to be released to users.
 */
const Certificates = () => {
  const { isAdmin } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [cities, setCities] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [certificateCounts, setCertificateCounts] = useState([]); // Track certificate counts per round/template
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ competition_id: "", city_id: "", status: "" });
  const [selected, setSelected] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Enhanced Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState("");
  const [selectedRound, setSelectedRound] = useState("");
  const [selectedRounds, setSelectedRounds] = useState([]);
  const [selectAllRounds, setSelectAllRounds] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedWinnerTemplate, setSelectedWinnerTemplate] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-filter when filter values change
  useEffect(() => {
    loadData();
  }, [filter.competition_id, filter.city_id, filter.status]);

  useEffect(() => {
    // Load rounds when competition filter changes
    if (filter.competition_id) {
      loadRoundsForCompetition(filter.competition_id);
    } else {
      setRounds([]);
      setSelectedRound("");
      setCertificateCounts([]);
    }
  }, [filter.competition_id]);

  const loadRoundsForCompetition = async (competitionId) => {
    try {
      console.log('Loading rounds for competition:', competitionId);
      const [roundsRes, countsRes] = await Promise.all([
        roundsAPI.getByCompetition(competitionId),
        certificatesAPI.getCountsByCompetition(competitionId)
      ]);
      console.log('Rounds loaded:', roundsRes.data.data);
      console.log('Certificate counts loaded:', countsRes.data.data);
      setRounds(roundsRes.data.data || []);
      setCertificateCounts(countsRes.data.data || []);
    } catch (error) {
      console.error("Failed to load rounds:", error);
      setRounds([]);
      setCertificateCounts([]);
    }
  };

  // Helper function to check if certificates exist for a round/template combination
  const getCertificateStatus = (roundId, templateId) => {
    const count = certificateCounts.find(
      c => c.round_id === roundId && c.template_id === parseInt(templateId)
    );
    if (!count) return { exists: false, generated: 0, released: 0, revoked: 0, total: 0 };
    return {
      exists: count.total_count > 0,
      generated: count.generated_count || 0,
      released: count.released_count || 0,
      revoked: count.revoked_count || 0,
      total: count.total_count || 0
    };
  };

  // Helper to get total certificate counts for a round (across all templates)
  const getRoundCertificateStatus = (roundId) => {
    const counts = certificateCounts.filter(c => c.round_id === roundId);
    return {
      exists: counts.some(c => c.total_count > 0),
      generated: counts.reduce((sum, c) => sum + (c.generated_count || 0), 0),
      released: counts.reduce((sum, c) => sum + (c.released_count || 0), 0),
      revoked: counts.reduce((sum, c) => sum + (c.revoked_count || 0), 0),
      total: counts.reduce((sum, c) => sum + (c.total_count || 0), 0)
    };
  };

  const loadData = async () => {
    try {
      setError(null);
      // Only pass non-empty filter values
      const params = {};
      if (filter.competition_id) params.competition_id = filter.competition_id;
      if (filter.city_id) params.city_id = filter.city_id;
      if (filter.status) params.status = filter.status;

      const [certsRes, compsRes, templatesRes, citiesRes] = await Promise.all([
        certificatesAPI.getAll(params),
        competitionsAPI.getAll(),
        templatesAPI.getAll(),
        competitionsAPI.getCities(),
      ]);

      console.log("Certificates response:", certsRes.data);
      setCertificates(certsRes.data.certificates || []);
      setCompetitions(compsRes.data.competitions || compsRes.data.data || []);
      setTemplates(templatesRes.data.templates || []);
      setCities(citiesRes.data.cities || citiesRes.data.data || []);
    } catch (err) {
      console.error("Failed to load:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (certId) => {
    try {
      await certificatesAPI.release(certId);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Release failed");
    }
  };

  const handleBulkRelease = async () => {
    if (selected.length === 0) return;

    try {
      await certificatesAPI.bulkRelease(selected);
      setSelected([]);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Bulk release failed");
    }
  };

  const handleReleaseByCompetition = async () => {
    if (!filter.competition_id) {
      alert("Please select a competition first");
      return;
    }

    if (!confirm(`Release all GENERATED certificates for this competition? This will make them available to users.`)) {
      return;
    }

    try {
      const generatedCerts = certificates.filter(c => c.status === 'GENERATED' && c.competition_id === parseInt(filter.competition_id));
      if (generatedCerts.length === 0) {
        alert("No generated certificates found for this competition");
        return;
      }
      await certificatesAPI.bulkRelease(generatedCerts.map(c => c.id));
      alert(`Released ${generatedCerts.length} certificates`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Release failed");
    }
  };

  const handleReleaseAll = async () => {
    const generatedCerts = certificates.filter((cert) => cert.status === "GENERATED");
    
    if (generatedCerts.length === 0) {
      alert("No generated certificates found");
      return;
    }

    if (!confirm(`Release ALL ${generatedCerts.length} generated certificates? This will make them available to all users.`)) {
      return;
    }

    try {
      await certificatesAPI.bulkRelease(generatedCerts.map((c) => c.id));
      alert(`Released ${generatedCerts.length} certificates`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Release failed");
    }
  };

  const handleWithdraw = async (certId) => {
    const reason = prompt("Enter reason for withdrawal:");
    if (!reason) return;

    try {
      await certificatesAPI.revoke(certId, reason);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Withdrawal failed");
    }
  };

  const handleReleaseByRound = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    const roundName = round ? `${round.city_name} - ${round.name}` : "this round";

    if (!confirm(`Release all GENERATED certificates for ${roundName}? This will make them available to users.`)) {
      return;
    }

    try {
      const response = await certificatesAPI.releaseByRound(roundId);
      alert(`Released ${response.data.affectedRows} certificates for ${roundName}`);
      loadData();
      // Reload certificate counts
      if (filter.competition_id) {
        const countsRes = await certificatesAPI.getCountsByCompetition(filter.competition_id);
        setCertificateCounts(countsRes.data.data || []);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Release failed");
    }
  };

  const handleWithdrawByRound = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    const roundName = round ? `${round.city_name} - ${round.name}` : "this round";

    const reason = prompt(`Enter reason for withdrawing ALL certificates of ${roundName}:`);
    if (!reason) return;

    if (!confirm(`Withdraw ALL certificates for ${roundName}?\n\nReason: ${reason}`)) {
      return;
    }

    try {
      const response = await certificatesAPI.revokeByRound(roundId, reason);
      alert(`Revoked ${response.data.affectedRows} certificates`);
      loadData();
      // Reload certificate counts
      if (filter.competition_id) {
        const countsRes = await certificatesAPI.getCountsByCompetition(filter.competition_id);
        setCertificateCounts(countsRes.data.data || []);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Withdrawal failed");
    }
  };

  const handleWithdrawByCompetition = async () => {
    if (!filter.competition_id) {
      alert("Please select a competition first");
      return;
    }

    const reason = prompt("Enter reason for withdrawing ALL certificates of this competition:");
    if (!reason) return;

    const certsToRevoke = certificates.filter(
      c => c.competition_id === parseInt(filter.competition_id) && c.status !== 'REVOKED'
    );

    if (certsToRevoke.length === 0) {
      alert("No certificates to revoke for this competition");
      return;
    }

    if (!confirm(`Withdraw ${certsToRevoke.length} certificates for this competition?\n\nReason: ${reason}`)) {
      return;
    }

    try {
      const response = await certificatesAPI.revokeByCompetition(filter.competition_id, reason);
      alert(`Revoked ${response.data.affectedRows} certificates`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Withdrawal failed");
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const openPreview = async (compOrCert = null) => {
    // Check if it's a certificate (has template_id and participation_id) or competition
    const isCertificate = compOrCert?.template_id && compOrCert?.participation_id;
    
    if (isCertificate) {
      // Opening from existing certificate
      setSelectedCompetition(compOrCert.competition_id || "");
      setSelectedTemplate(compOrCert.template_id || "");
      setSelectedParticipant(compOrCert.participation_id || "");
      setPreviewData(null);

      // Load participants for the competition
      if (compOrCert.competition_id) {
        try {
          const response = await competitionsAPI.getParticipants(compOrCert.competition_id);
          setParticipants(response.data.participants || response.data.data || []);
        } catch (error) {
          console.error("Failed to load participants:", error);
          setParticipants([]);
        }
      }
    } else {
      // Opening from competition or new
      setSelectedCompetition(compOrCert?.id || "");
      setSelectedTemplate(templates[0]?.id || "");
      setSelectedParticipant("");
      setPreviewData(null);

      // Load participants if competition selected
      if (compOrCert?.id) {
        try {
          const response = await competitionsAPI.getParticipants(compOrCert.id);
          setParticipants(response.data.participants || response.data.data || []);
        } catch (error) {
          console.error("Failed to load participants:", error);
          setParticipants([]);
        }
      }
    }

    setShowPreview(true);
  };

  const handleCompetitionChange = async (competitionId) => {
    setSelectedCompetition(competitionId);
    setSelectedParticipant("");
    setSelectedRound("");
    setPreviewData(null);

    if (competitionId) {
      try {
        const [participantsRes, roundsRes] = await Promise.all([
          competitionsAPI.getParticipants(competitionId),
          roundsAPI.getByCompetition(competitionId)
        ]);
        
        setParticipants(participantsRes.data.participants || participantsRes.data.data || []);
        setRounds(roundsRes.data.data || []);

        // Auto-select the linked template for this competition
        const linkedTemplate = templates.find(
          (t) => t.competition_id === parseInt(competitionId)
        );
        if (linkedTemplate) {
          setSelectedTemplate(linkedTemplate.id);
        }
      } catch (error) {
        console.error("Failed to load participants:", error);
        setParticipants([]);
        setRounds([]);
      }
    } else {
      setRounds([]);
    }
  };

  const handleGenerateForRound = async () => {
    const roundsToGenerate = selectAllRounds ? rounds.map(r => r.id) : selectedRounds;
    
    if (roundsToGenerate.length === 0 || !selectedTemplate) {
      alert("Please select at least one round and a template");
      return;
    }

    const totalParticipants = rounds
      .filter(r => roundsToGenerate.includes(r.id))
      .reduce((sum, r) => sum + r.participant_count, 0);

    const hasExisting = roundsToGenerate.some(roundId => getCertificateStatus(roundId, selectedTemplate).exists);
    const action = hasExisting ? "Regenerate" : "Generate";

    if (!confirm(`${action} certificates for ${roundsToGenerate.length} round(s) with ${totalParticipants} total participants?`)) {
      return;
    }

    try {
      setLoading(true);
      
      // Generate for each selected round
      let totalSuccess = 0;
      let totalFailed = 0;
      
      for (const roundId of roundsToGenerate) {
        const response = await certificatesAPI.generateForRound({
          round_id: roundId,
          template_id: selectedTemplate
        });
        totalSuccess += response.data.results.success.length;
        totalFailed += response.data.results.failed.length;
      }
      
      alert(`Generated certificates: ${totalSuccess} successful, ${totalFailed} failed`);
      setSelectedRounds([]);
      setSelectAllRounds(false);
      loadData();
      // Reload certificate counts
      if (filter.competition_id) {
        const countsRes = await certificatesAPI.getCountsByCompetition(filter.competition_id);
        setCertificateCounts(countsRes.data.data || []);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForWinners = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    const roundName = round ? `${round.city_name} - ${round.name}` : "this round";

    if (!selectedWinnerTemplate) {
      alert("Please select a Winner Certificate template first");
      return;
    }

    const status = getCertificateStatus(roundId, selectedWinnerTemplate);
    const action = status.exists ? "Regenerate" : "Generate";

    if (!confirm(`${action} certificates for WINNERS ONLY in ${roundName} using the selected winner template?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await certificatesAPI.generateForWinners({
        round_id: roundId,
        template_id: selectedWinnerTemplate
      });
      
      alert(`Generated ${response.data.results.success.length} winner certificates, ${response.data.results.failed.length} failed`);
      loadData();
      // Reload certificate counts
      if (filter.competition_id) {
        const countsRes = await certificatesAPI.getCountsByCompetition(filter.competition_id);
        setCertificateCounts(countsRes.data.data || []);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseForWinners = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    const roundName = round ? `${round.city_name} - ${round.name}` : "this round";

    const templateMsg = selectedWinnerTemplate 
      ? "Only certificates generated with the selected winner template will be released."
      : "ALL winner certificates (from any template) will be released.";

    if (!confirm(`Release winner certificates for ${roundName}?\n\n${templateMsg}`)) {
      return;
    }

    try {
      const response = await certificatesAPI.releaseForWinners(roundId, selectedWinnerTemplate || null);
      alert(`Released ${response.data.affectedRows} winner certificates for ${roundName}`);
      loadData();
      // Reload certificate counts
      if (filter.competition_id) {
        const countsRes = await certificatesAPI.getCountsByCompetition(filter.competition_id);
        setCertificateCounts(countsRes.data.data || []);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Release failed");
    }
  };

  const handleWithdrawForWinners = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    const roundName = round ? `${round.city_name} - ${round.name}` : "this round";

    const reason = prompt(`Enter reason for withdrawing winner certificates of ${roundName}:`);
    if (!reason) return;

    const templateMsg = selectedWinnerTemplate 
      ? "Only certificates from the selected template will be withdrawn."
      : "ALL winner certificates (from any template) will be withdrawn.";

    if (!confirm(`Withdraw winner certificates for ${roundName}?\n\n${templateMsg}\n\nReason: ${reason}`)) {
      return;
    }

    try {
      const response = await certificatesAPI.withdrawForWinners(roundId, selectedWinnerTemplate || null, reason);
      alert(`Withdrew ${response.data.affectedRows} winner certificates`);
      loadData();
      // Reload certificate counts
      if (filter.competition_id) {
        const countsRes = await certificatesAPI.getCountsByCompetition(filter.competition_id);
        setCertificateCounts(countsRes.data.data || []);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Withdrawal failed");
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate || !selectedParticipant) {
      alert("Please select both template and participant");
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await certificatesAPI.preview(
        selectedTemplate,
        selectedParticipant
      );
      console.log("Preview response:", response.data);
      const previewResult = response.data.preview || response.data.data;
      console.log("Preview data:", previewResult);
      
      // Convert base64 to blob URL for better browser support
      if (previewResult.base64) {
        const binaryString = atob(previewResult.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Revoke old blob URL if exists
        if (previewData?.blobUrl) {
          URL.revokeObjectURL(previewData.blobUrl);
        }
        
        setPreviewData({
          ...previewResult,
          blobUrl
        });
      } else {
        setPreviewData(previewResult);
      }
    } catch (error) {
      console.error("Preview error:", error);
      alert(error.response?.data?.message || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
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
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Certificate Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage generated certificates - Preview and release to users
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {competitions.length} competitions, {templates.length} templates,{" "}
            {certificates.length} certificates generated
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openPreview()} className="btn-outline">
            🔍 Preview Certificate
          </button>
          {isAdmin && (
            <button onClick={handleReleaseAll} className="btn-success">
              📤 Release All Generated
            </button>
          )}
          {isAdmin && filter.competition_id && (
            <button onClick={handleReleaseByCompetition} className="btn-primary">
              📤 Release All for Competition
            </button>
          )}
          {isAdmin && filter.competition_id && (
            <button onClick={handleWithdrawByCompetition} className="btn-danger">
              🚫 Withdraw All for Competition
            </button>
          )}
          {isAdmin && selected.length > 0 && (
            <button onClick={handleBulkRelease} className="btn-success">
              Release Selected ({selected.length})
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <select
            value={filter.competition_id}
            onChange={(e) => {
              setFilter({ ...filter, competition_id: e.target.value });
            }}
            className="input-admin w-full sm:w-auto sm:max-w-xs"
          >
            <option value="">All Competitions</option>
            {competitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </select>
          <select
            value={filter.city_id}
            onChange={(e) => setFilter({ ...filter, city_id: e.target.value })}
            className="input-admin w-full sm:w-auto sm:max-w-xs"
          >
            <option value="">All Cities</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="input-admin w-full sm:w-auto sm:max-w-xs"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="GENERATED">Generated</option>
            <option value="RELEASED">Released</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>

        {/* Round-specific certificate generation */}
        {filter.competition_id && rounds.length > 0 && (
          <div className="admin-card p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30">
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">🏆 Generate Certificates for Rounds</h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3">Select one or more rounds to generate certificates</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
              {/* All Rounds Checkbox */}
              <div className="col-span-full">
                <label className="flex items-center gap-2 p-2 sm:p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={selectAllRounds}
                    onChange={(e) => {
                      setSelectAllRounds(e.target.checked);
                      if (e.target.checked) {
                        setSelectedRounds([]);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-white font-medium">Select All Rounds ({rounds.length} rounds, {rounds.reduce((sum, r) => sum + r.participant_count, 0)} participants)</span>
                </label>
              </div>

              {/* Individual Round Checkboxes */}
              {!selectAllRounds && rounds.map((round) => {
                const status = getCertificateStatus(round.id, selectedTemplate);
                return (
                <label key={round.id} className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={selectedRounds.includes(round.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRounds([...selectedRounds, round.id]);
                      } else {
                        setSelectedRounds(selectedRounds.filter(id => id !== round.id));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-white flex-1">
                    {round.city_name} - {round.name} <span className="text-gray-400">({round.participant_count} participants)</span>
                    {selectedTemplate && status.exists && (
                      <span className="text-xs ml-2 text-blue-400">
                        ✓ {status.total} certs ({status.generated} pending, {status.released} released)
                      </span>
                    )}
                  </span>
                </label>
              )})}
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Select Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="input-admin"
                >
                  <option value="">Select template...</option>
                  {templates.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                // Check if any selected round has existing certificates
                const roundsToCheck = selectAllRounds ? rounds.map(r => r.id) : selectedRounds;
                const hasExisting = roundsToCheck.some(roundId => getCertificateStatus(roundId, selectedTemplate).exists);
                return (
                  <button 
                    onClick={handleGenerateForRound}
                    disabled={(!selectAllRounds && selectedRounds.length === 0) || !selectedTemplate}
                    className={`${hasExisting ? 'bg-orange-600 hover:bg-orange-500' : ''} btn-primary disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    📜 {hasExisting ? 'Regenerate' : 'Generate'} Certificates
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* Winner Certificate Generation - only for finale rounds */}
        {filter.competition_id && rounds.some(r => r.is_finale) && isAdmin && (
          <div className="admin-card p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/30">
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">🏆 Generate Winner Certificates</h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3">Generate certificates for selected winners using a special Winner Certificate template.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Winner Certificate Template</label>
                <select
                  value={selectedWinnerTemplate}
                  onChange={(e) => setSelectedWinnerTemplate(e.target.value)}
                  className="input-admin w-full"
                >
                  <option value="">Select winner template...</option>
                  {templates.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              {rounds.filter(r => r.is_finale).map((round) => {
                const templateStatus = getCertificateStatus(round.id, selectedWinnerTemplate);
                const roundStatus = getRoundCertificateStatus(round.id);
                // Use template-specific status if template selected, otherwise use round totals
                const displayStatus = selectedWinnerTemplate ? templateStatus : roundStatus;
                
                return (
                <div key={round.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-800/50 rounded-lg">
                  <div className="text-white">
                    <span className="font-medium">{round.city_name}</span>
                    <span className="text-gray-400"> - </span>
                    <span>{round.name}</span>
                    <span className="badge badge-warning text-xs ml-2">Finals</span>
                    {displayStatus.exists && (
                      <span className="text-xs ml-2 text-gray-400">
                        ({displayStatus.total} certs: {displayStatus.generated} pending, {displayStatus.released} released{displayStatus.revoked > 0 ? `, ${displayStatus.revoked} withdrawn` : ''})
                        {!selectedWinnerTemplate && <span className="text-yellow-400"> - all templates</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleGenerateForWinners(round.id)}
                      disabled={!selectedWinnerTemplate}
                      className={`${templateStatus.exists ? 'bg-orange-600 hover:bg-orange-500' : 'bg-yellow-600 hover:bg-yellow-500'} text-white text-xs px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={templateStatus.exists ? "Regenerate certificates for selected winners" : "Generate certificates for selected winners only"}
                    >
                      🏆 {templateStatus.exists ? 'Regenerate' : 'Generate'}
                    </button>
                    <button
                      onClick={() => handleReleaseForWinners(round.id)}
                      disabled={displayStatus.generated === 0}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title={selectedWinnerTemplate ? "Release winner certificates from selected template" : "Release ALL winner certificates"}
                    >
                      🥇 Release{!selectedWinnerTemplate && ' All'}
                    </button>
                    <button
                      onClick={() => handleWithdrawForWinners(round.id)}
                      disabled={displayStatus.generated === 0 && displayStatus.released === 0}
                      className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title={selectedWinnerTemplate ? "Withdraw winner certificates from selected template" : "Withdraw ALL winner certificates"}
                    >
                      🚫 Withdraw{!selectedWinnerTemplate && ' All'}
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Round-specific certificate release/withdraw */}
        {filter.competition_id && rounds.length > 0 && isAdmin && (
          <div className="admin-card p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/30">
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">📤 Release/Withdraw Certificates by Round</h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3">Release or withdraw certificates for all participants in specific rounds.</p>
            
            <div className="space-y-2">
              {rounds.map((round) => {
                // Get total certificate counts for this round (across all templates)
                const roundCounts = certificateCounts.filter(c => c.round_id === round.id);
                const totalCerts = roundCounts.reduce((sum, c) => sum + (c.total_count || 0), 0);
                const generatedCerts = roundCounts.reduce((sum, c) => sum + (c.generated_count || 0), 0);
                const releasedCerts = roundCounts.reduce((sum, c) => sum + (c.released_count || 0), 0);
                const revokedCerts = roundCounts.reduce((sum, c) => sum + (c.revoked_count || 0), 0);
                
                return (
                <div key={round.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-800/50 rounded-lg">
                  <div className="text-white">
                    <span className="font-medium">{round.city_name}</span>
                    <span className="text-gray-400"> - </span>
                    <span>{round.name}</span>
                    <span className="text-gray-500 text-sm ml-2">({round.participant_count} participants)</span>
                    {round.is_finale && (
                      <span className="badge badge-warning text-xs ml-2">Finals</span>
                    )}
                    {totalCerts > 0 && (
                      <span className="text-xs ml-2 text-emerald-400">
                        📜 {totalCerts} certs ({generatedCerts} pending, {releasedCerts} released{revokedCerts > 0 ? `, ${revokedCerts} withdrawn` : ''})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleReleaseByRound(round.id)}
                      disabled={generatedCerts === 0}
                      className="btn-success text-xs px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Release all certificates for this round"
                    >
                      📤 Release All
                    </button>
                    <button
                      onClick={() => handleWithdrawByRound(round.id)}
                      disabled={totalCerts === 0 || (generatedCerts === 0 && releasedCerts === 0)}
                      className="btn-danger text-xs px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Withdraw all certificates for this round"
                    >
                      🚫 Withdraw All
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {certificates.map((cert) => (
          <div key={cert.id} className="admin-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-blue-400 text-sm">{cert.mi_id || '-'}</span>
                  <span
                    className={`badge text-xs ${
                      cert.status === "RELEASED"
                        ? "badge-success"
                        : "badge-warning"
                    }`}
                  >
                    {cert.status}
                  </span>
                </div>
                <div className="font-medium text-white truncate">{cert.user_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openPreview(cert)}
                  className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 border border-blue-400/30 rounded"
                >
                  Preview
                </button>
                <button
                  onClick={() => toggleExpand(cert.id)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  {expandedRows.has(cert.id) ? '▲' : '▼'}
                </button>
              </div>
            </div>
            {expandedRows.has(cert.id) && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Competition:</span>
                  <span className="text-white">{cert.competition_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">City:</span>
                  <span className="text-white">{cert.city_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Result:</span>
                  <span className={`badge text-xs ${cert.result_status === "WINNER" ? "badge-success" : cert.result_status === "FINALIST" ? "badge-warning" : "badge-info"}`}>
                    {cert.result_status || "PARTICIPATED"}{cert.position && ` #${cert.position}`}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-2">
                    {cert.status === "GENERATED" && (
                      <button
                        onClick={() => handleRelease(cert.id)}
                        className="text-emerald-400 hover:text-emerald-300 text-xs px-2 py-1 border border-emerald-400/30 rounded"
                      >
                        ✅ Release
                      </button>
                    )}
                    {cert.status === "RELEASED" && (
                      <button
                        onClick={() => handleWithdraw(cert.id)}
                        className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400/30 rounded"
                      >
                        ⛔ Withdraw
                      </button>
                    )}
                    {cert.status === "REVOKED" && (
                      <button
                        onClick={() => handleRelease(cert.id)}
                        className="text-emerald-400 hover:text-emerald-300 text-xs px-2 py-1 border border-emerald-400/30 rounded"
                      >
                        🔄 Re-Release
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {certificates.length === 0 && (
          <div className="admin-card p-8 text-center text-gray-500">
            No certificates found
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              {isAdmin && <th className="w-8"></th>}
              <th>MI ID</th>
              <th>User</th>
              <th>Competition</th>
              <th>City</th>
              <th>Result</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {certificates.map((cert) => (
              <tr key={cert.id}>
                {isAdmin && (
                  <td>
                    {cert.status === "GENERATED" && (
                      <input
                        type="checkbox"
                        checked={selected.includes(cert.id)}
                        onChange={() => toggleSelect(cert.id)}
                        className="w-4 h-4"
                      />
                    )}
                  </td>
                )}
                <td className="font-medium text-blue-400">{cert.mi_id || '-'}</td>
                <td className="font-medium text-white">{cert.user_name}</td>
                <td className="text-gray-400">{cert.competition_name}</td>
                <td className="text-gray-400">{cert.city_name}</td>
                <td>
                  <span
                    className={`badge ${
                      cert.result_status === "WINNER"
                        ? "badge-success"
                        : cert.result_status === "FINALIST"
                        ? "badge-warning"
                        : "badge-info"
                    }`}
                  >
                    {cert.result_status || "PARTICIPATED"}
                    {cert.position && ` #${cert.position}`}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      cert.status === "RELEASED"
                        ? "badge-success"
                        : "badge-warning"
                    }`}
                  >
                    {cert.status}
                  </span>
                </td>
                <td className="space-x-2">
                  <button
                    onClick={() => openPreview(cert)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Preview
                  </button>
                  {isAdmin && cert.status === "GENERATED" && (
                    <button
                      onClick={() => handleRelease(cert.id)}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                      ✅ Release
                    </button>
                  )}
                  {isAdmin && cert.status === "RELEASED" && (
                    <button
                      onClick={() => handleWithdraw(cert.id)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      ⛔ Withdraw
                    </button>
                  )}
                  {isAdmin && cert.status === "REVOKED" && (
                    <button
                      onClick={() => handleRelease(cert.id)}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                      🔄 Re-Release
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {certificates.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center text-gray-500 py-8"
                >
                  No certificates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Certificate Preview
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-gray-700">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="input-admin w-full"
                  >
                    <option value="">Select template...</option>
                    {templates
                      .filter((t) => t.field_count > 0 && t.status === "ACTIVE")
                      .map((t) => {
                        const linkedComp = competitions.find(
                          (c) => c.id === t.competition_id
                        );
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.field_count} fields)
                            {linkedComp ? ` ✓ ${linkedComp.name}` : ""}
                          </option>
                        );
                      })}
                  </select>
                  {selectedCompetition &&
                    templates.find(
                      (t) => t.competition_id === parseInt(selectedCompetition)
                    ) && (
                      <p className="text-xs text-green-400 mt-1">
                        ✓ Template auto-selected from linked competition
                      </p>
                    )}
                  {templates.filter(
                    (t) => t.field_count > 0 && t.status === "ACTIVE"
                  ).length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">
                      No active templates with fields configured. Go to
                      Templates to add fields.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Competition
                  </label>
                  <select
                    value={selectedCompetition}
                    onChange={(e) => handleCompetitionChange(e.target.value)}
                    className="input-admin w-full"
                  >
                    <option value="">Select competition...</option>
                    {competitions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Participant
                  </label>
                  <select
                    value={selectedParticipant}
                    onChange={(e) => setSelectedParticipant(e.target.value)}
                    className="input-admin w-full"
                    disabled={!selectedCompetition}
                  >
                    <option value="">Select participant...</option>
                    {participants.map((p, index) => (
                      <option key={`${p.id}-${index}`} value={p.id}>
                        {p.full_name} {p.city_name ? `(${p.city_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handlePreview}
                  disabled={
                    previewLoading || !selectedTemplate || !selectedParticipant
                  }
                  className="btn-primary"
                >
                  {previewLoading ? "Loading..." : "Generate Preview"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {previewData ? (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-400">
                      Participant:{" "}
                      <span className="text-white">
                        {previewData.participant}
                      </span>{" "}
                      | Competition:{" "}
                      <span className="text-white">
                        {previewData.competition}
                      </span>{" "}
                      | City:{" "}
                      <span className="text-white">{previewData.city}</span>
                    </div>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewData.blobUrl || `data:application/pdf;base64,${previewData.base64}`;
                        link.download = `certificate_preview_${Date.now()}.pdf`;
                        link.click();
                      }}
                      className="btn-outline text-sm"
                    >
                      📥 Download
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 bg-gray-900 rounded border border-gray-700 overflow-hidden">
                    <PdfPreview
                      base64Data={previewData.base64}
                      blobUrl={previewData.blobUrl}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-[60vh] flex items-center justify-center text-gray-500">
                  Select a template and click "Generate Preview" to see the
                  certificate
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Certificates;
