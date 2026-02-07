import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roundsAPI, competitionsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const RoundManagement = () => {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { isAdmin } = useAuth();

    const [competition, setCompetition] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRound, setSelectedRound] = useState(null);
    const [roundDetails, setRoundDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Modals
    const [showCreateRound, setShowCreateRound] = useState(false);
    const [showPromote, setShowPromote] = useState(false);
    const [showAddParticipant, setShowAddParticipant] = useState(false);
    const [showSelectWinners, setShowSelectWinners] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [cityStatuses, setCityStatuses] = useState({});
    const [availableCityWinners, setAvailableCityWinners] = useState([]);
    const [importSelections, setImportSelections] = useState({});

    // Form states
    const [newRound, setNewRound] = useState({ city_id: '', name: '', round_number: 1, is_finale: false });
    const [promoteCount, setPromoteCount] = useState(5);
    const [eligibleParticipants, setEligibleParticipants] = useState([]);
    const [selectedParticipant, setSelectedParticipant] = useState('');
    const [participantSearch, setParticipantSearch] = useState('');
    const [roundParticipantSearch, setRoundParticipantSearch] = useState('');
    const [uploadProgress, setUploadProgress] = useState(null);
    const [uploadErrors, setUploadErrors] = useState(null);
    const [showUploadErrorsModal, setShowUploadErrorsModal] = useState(false);
    const [editingScore, setEditingScore] = useState(null);
    const [winners, setWinners] = useState([]);

    // Helper function to get the next round number for a city
    const getNextRoundNumber = (cityId) => {
        const cityRounds = rounds.filter(r => r.city_id === parseInt(cityId));
        if (cityRounds.length === 0) return 1;
        return Math.max(...cityRounds.map(r => r.round_number)) + 1;
    };

    // Update round number when city is selected
    const handleCityChange = (cityId) => {
        const nextRoundNumber = getNextRoundNumber(cityId);
        setNewRound({ ...newRound, city_id: cityId, round_number: nextRoundNumber });
    };

    useEffect(() => {
        loadData();
    }, [competitionId]);

    // Load city statuses when rounds change
    useEffect(() => {
        const loadCityStatuses = async () => {
            if (!competition?.cities) return;
            const statuses = {};
            for (const city of competition.cities) {
                try {
                    const res = await roundsAPI.getCityStatus(competitionId, city.city_id);
                    statuses[city.city_id] = res.data.data;
                } catch (e) {
                    console.log('Could not load city status:', e);
                }
            }
            setCityStatuses(statuses);
        };
        if (competition && rounds.length > 0) {
            loadCityStatuses();
        }
    }, [competition, rounds]);

    const handleMarkCityFinished = async (cityId) => {
        if (!window.confirm('Mark this city as finished? This will add winners to results and may complete the competition.')) {
            return;
        }
        try {
            const res = await roundsAPI.markCityFinished(competitionId, cityId);
            alert(res.data.message);
            loadData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to mark city as finished');
        }
    };

    const handleReopenCity = async (cityId, cityName) => {
        if (!window.confirm(`Reopen ${cityName}? This will remove winners from results and allow you to modify rounds.`)) {
            return;
        }
        try {
            const res = await roundsAPI.reopenCity(competitionId, cityId);
            alert(res.data.message);
            loadData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to reopen city');
        }
    };

    const loadData = async () => {
        try {
            const [compRes, roundsRes, citiesRes] = await Promise.all([
                competitionsAPI.getById(competitionId),
                roundsAPI.getByCompetition(competitionId),
                competitionsAPI.getCities()
            ]);
            setCompetition(compRes.data.data);
            setRounds(roundsRes.data.data);
            setCities(citiesRes.data.data);
        } catch (error) {
            console.error('Failed to load:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRoundDetails = async (roundId) => {
        setDetailsLoading(true);
        setSelectedRound(roundId);
        try {
            const response = await roundsAPI.getDetails(roundId);
            setRoundDetails(response.data.data);
        } catch (error) {
            console.error('Failed to load round details:', error);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleCreateRound = async (e) => {
        e.preventDefault();
        try {
            await roundsAPI.create({
                competition_id: parseInt(competitionId),
                ...newRound,
                city_id: parseInt(newRound.city_id)
            });
            setShowCreateRound(false);
            setNewRound({ city_id: '', name: '', round_number: 1, is_finale: false });
            loadData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create round');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedRound) return;

        setUploadProgress('Uploading...');
        try {
            const response = await roundsAPI.uploadScores(selectedRound, file);
            const result = response.data.data;
            
            setUploadProgress(
                `Success: ${result.success} scores uploaded` +
                (result.skipped > 0 ? `, ${result.skipped} skipped (already exist)` : '') +
                (result.failed > 0 ? `, ${result.failed} failed` : '')
            );
            
            // Show errors modal if there are failures
            if (result.failed > 0 && result.errors && result.errors.length > 0) {
                setUploadErrors(result.errors);
                setShowUploadErrorsModal(true);
            }
            
            loadRoundDetails(selectedRound);
            setTimeout(() => setUploadProgress(null), 5000);
        } catch (error) {
            setUploadProgress(`Error: ${error.response?.data?.message || 'Upload failed'}`);
        }
        e.target.value = '';
    };

    const handlePromote = async () => {
        try {
            const response = await roundsAPI.promote(selectedRound, promoteCount);
            const promoted = response.data.data.promoted;
            alert(`✅ Success! Promoted ${promoted} participant${promoted !== 1 ? 's' : ''} to next round`);
            setShowPromote(false);
            loadData();
            loadRoundDetails(selectedRound);
        } catch (error) {
            console.error('Promotion error:', error.response?.data);
            alert(error.response?.data?.message || error.message || 'Promotion failed');
        }
    };

    const handleClearScores = async () => {
        if (!confirm('Are you sure you want to clear ALL scores for this round? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await roundsAPI.clearScores(selectedRound);
            alert(`Cleared ${response.data.data.deletedCount} scores`);
            loadRoundDetails(selectedRound);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to clear scores');
        }
    };

    const loadEligibleParticipants = async () => {
        try {
            const response = await roundsAPI.getEligibleParticipants(selectedRound);
            setEligibleParticipants(response.data.data);
            setParticipantSearch('');
            setShowAddParticipant(true);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to load participants');
        }
    };

    const handleAddParticipant = async () => {
        if (!selectedParticipant) return;
        try {
            await roundsAPI.addParticipant(selectedRound, parseInt(selectedParticipant));
            setShowAddParticipant(false);
            setSelectedParticipant('');
            loadData(); // Refresh rounds list with updated counts
            loadRoundDetails(selectedRound); // Refresh current round
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to add participant');
        }
    };

    const handlePromoteIndividual = async (participationId, participantName) => {
        if (!roundDetails) return;
        
        // Find next round
        const nextRoundNumber = roundDetails.round_number + 1;
        const nextRound = rounds.find(r => 
            r.city_id === roundDetails.city_id && 
            r.round_number === nextRoundNumber
        );

        if (!nextRound) {
            alert(`Next round (Round ${nextRoundNumber}) does not exist for ${roundDetails.city_name}. Please create it first.`);
            return;
        }

        if (!window.confirm(`Promote ${participantName} to ${nextRound.name}?`)) {
            return;
        }

        try {
            console.log('Promoting participant:', { participationId, nextRoundId: nextRound.id, participantName });
            await roundsAPI.addParticipant(nextRound.id, participationId);
            alert(`${participantName} promoted to ${nextRound.name}`);
            loadData(); // Refresh rounds list with updated counts
            loadRoundDetails(selectedRound); // Refresh current round
        } catch (error) {
            console.error('Promotion error:', error.response?.data);
            alert(error.response?.data?.message || error.message || 'Failed to promote participant');
        }
    };

    const handleRemoveParticipant = async (participationId, participantName) => {
        if (!window.confirm(`Remove ${participantName} from ${roundDetails.name}?`)) {
            return;
        }

        try {
            await roundsAPI.removeParticipant(selectedRound, participationId);
            alert(`${participantName} removed from round`);
            loadData(); // Refresh rounds list with updated counts
            loadRoundDetails(selectedRound); // Refresh current round
        } catch (error) {
            console.error('Remove error:', error.response?.data);
            alert(error.response?.data?.message || error.message || 'Failed to remove participant');
        }
    };

    const handleScoreUpdate = async (roundParticipationId, score, notes) => {
        try {
            await roundsAPI.updateScore(roundParticipationId, parseFloat(score), notes);
            setEditingScore(null);
            loadRoundDetails(selectedRound);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update score');
        }
    };

    const handleSelectWinners = async (e) => {
        e.preventDefault();
        try {
            await roundsAPI.selectWinners(selectedRound, winners);
            alert('Winners selected successfully!');
            setShowSelectWinners(false);
            setWinners([]);
            loadData(); // Refresh rounds list with updated counts and statuses
            loadRoundDetails(selectedRound);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to select winners');
        }
    };

    const openImportWinnersModal = async () => {
        try {
            setUploadProgress('Loading available winners...');
            const response = await roundsAPI.getAvailableWinners(selectedRound);
            console.log('Available winners response:', response.data);
            const cities = response.data.cities || response.data.data || [];
            setAvailableCityWinners(cities);
            // Pre-fill with all winners from each city
            const initialSelections = {};
            cities.forEach(city => {
                initialSelections[city.city_id] = city.winner_count;
            });
            setImportSelections(initialSelections);
            setUploadProgress(null);
            setShowImportModal(true);
        } catch (error) {
            setUploadProgress(`Error: ${error.response?.data?.message || 'Failed to load winners'}`);
        }
    };

    const handleImportSelectedWinners = async () => {
        // Build city selections array with only cities that have count > 0
        const citySelections = Object.entries(importSelections)
            .filter(([_, count]) => count > 0)
            .map(([cityId, count]) => ({
                city_id: parseInt(cityId),
                count: parseInt(count)
            }));

        if (citySelections.length === 0) {
            alert('Please select at least one winner to import');
            return;
        }

        try {
            setUploadProgress('Importing selected winners...');
            const response = await roundsAPI.importSelectedWinners(selectedRound, citySelections);
            setUploadProgress(`Success: ${response.data.message}`);
            setShowImportModal(false);
            loadRoundDetails(selectedRound);
            setTimeout(() => setUploadProgress(''), 3000);
        } catch (error) {
            setUploadProgress(`Error: ${error.response?.data?.message || 'Failed to import winners'}`);
        }
    };

    const toggleWinner = (rpId, position) => {
        setWinners(prev => {
            const existing = prev.find(w => w.round_participation_id === rpId);
            if (existing) {
                return prev.filter(w => w.round_participation_id !== rpId);
            }
            return [...prev, { round_participation_id: rpId, position }];
        });
    };

    const handleDeleteRound = async () => {
        if (!roundDetails) return;
        if (!window.confirm(`Delete ${roundDetails.name}? This will also delete all participants and scores from this round. This action cannot be undone.`)) {
            return;
        }
        try {
            await roundsAPI.delete(selectedRound);
            alert(`${roundDetails.name} deleted successfully`);
            setSelectedRound(null);
            setRoundDetails(null);
            loadData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete round');
        }
    };

    const handleArchiveRound = async () => {
        if (!roundDetails) return;
        if (!window.confirm(`Archive ${roundDetails.name}? Archived rounds won't be counted in results but data is preserved.`)) {
            return;
        }
        try {
            await roundsAPI.archive(selectedRound);
            alert(`${roundDetails.name} archived successfully`);
            loadData();
            loadRoundDetails(selectedRound);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to archive round');
        }
    };

    const handleUnarchiveRound = async () => {
        if (!roundDetails) return;
        try {
            await roundsAPI.unarchive(selectedRound);
            alert(`${roundDetails.name} restored from archive`);
            loadData();
            loadRoundDetails(selectedRound);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to unarchive round');
        }
    };

    // Group rounds by city
    const roundsByCity = rounds.reduce((acc, round) => {
        const key = round.city_name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(round);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <button
                        onClick={() => navigate('/competitions')}
                        className="text-gray-400 hover:text-white text-sm mb-2"
                    >
                        ← Back to Competitions
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">{competition?.name} - Rounds</h1>
                </div>
                <button onClick={() => setShowCreateRound(true)} className="btn-admin w-full sm:w-auto">
                    + New Round
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Rounds List (Left Panel) */}
                <div className="lg:col-span-1 space-y-4">
                    {Object.entries(roundsByCity).map(([cityName, cityRounds]) => {
                        const cityId = cityRounds[0]?.city_id;
                        const cityStatus = cityStatuses[cityId];
                        return (
                        <div key={cityName} className="admin-card p-3 sm:p-4">
                            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 break-words">{cityName}</h3>
                            <div className="space-y-2">
                                {cityRounds.sort((a, b) => a.round_number - b.round_number).map((round) => (
                                    <button
                                        key={round.id}
                                        onClick={() => loadRoundDetails(round.id)}
                                        className={`w-full text-left p-2 sm:p-3 rounded-lg transition-colors ${selectedRound === round.id
                                            ? 'bg-blue-600/30 border border-blue-500'
                                            : 'bg-gray-800/50 hover:bg-gray-700/50 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className={`font-medium text-sm sm:text-base break-words ${round.status === 'ARCHIVED' ? 'text-gray-500' : 'text-white'}`}>
                                                {round.name}
                                                {Boolean(round.is_finale) && ' 🏆'}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${round.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                                round.status === 'IN_PROGRESS' ? 'bg-yellow-500/20 text-yellow-400' :
                                                round.status === 'ARCHIVED' ? 'bg-gray-600/20 text-gray-500' :
                                                    'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {round.status === 'ARCHIVED' ? '📦 Archived' : round.status}
                                            </span>
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-400 mt-1">
                                            {round.participant_count} participants • {round.scored_count} scored
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {/* Mark City Finished / Reopen Button */}
                            {cityStatus?.can_mark_finished && (
                                <button
                                    onClick={() => handleMarkCityFinished(cityId)}
                                    className="w-full mt-3 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    ✅ Mark {cityName} as Finished
                                </button>
                            )}
                            {cityStatus?.is_finished && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-xs text-green-400 bg-green-500/10 p-2 rounded flex items-center gap-2">
                                        <span>✅</span>
                                        <span>City is finished - winners added to results</span>
                                    </div>
                                    <button
                                        onClick={() => handleReopenCity(cityId, cityName)}
                                        className="w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        🔓 Reopen {cityName}
                                    </button>
                                </div>
                            )}
                            {cityStatus && !cityStatus.can_mark_finished && !cityStatus.is_finished && cityStatus.has_finale && !cityStatus.finale_completed && (
                                <div className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                                    ⚠️ Complete the finale round to finish this city
                                </div>
                            )}
                        </div>
                    );
                    })}
                    {rounds.length === 0 && (
                        <div className="admin-card p-8 text-center text-gray-500">
                            No rounds created yet. Click "+ New Round" to start.
                        </div>
                    )}
                </div>

                {/* Round Details (Right Panel) */}
                <div className="lg:col-span-2">
                    {detailsLoading ? (
                        <div className="admin-card p-8 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : roundDetails ? (
                        <div className="admin-card p-5">
                            {/* Round Header */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {roundDetails.name}
                                        {Boolean(roundDetails.is_finale) && ' 🏆'}
                                    </h2>
                                    <p className="text-gray-400 text-sm">
                                        {roundDetails.city_name} • Round {roundDetails.round_number}
                                        {roundDetails.round_date && ` • ${new Date(roundDetails.round_date).toLocaleDateString()}`}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="btn-outline text-sm"
                                    >
                                        📤 Upload CSV
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    {isAdmin && (
                                        <button
                                            onClick={handleClearScores}
                                            className="btn-outline text-sm text-red-400 border-red-400 hover:bg-red-400/10"
                                            title="Clear all scores for this round"
                                            disabled={!roundDetails?.scored_count || roundDetails.scored_count === 0}
                                        >
                                            🗑️ Clear Scores
                                        </button>
                                    )}
                                    <button
                                        onClick={loadEligibleParticipants}
                                        className="btn-outline text-sm"
                                    >
                                        + Add Participant
                                    </button>
                                    {!!(roundDetails.round_number > 1 || roundDetails.is_finale) && (
                                        <button
                                            onClick={openImportWinnersModal}
                                            className="btn-outline text-sm"
                                            title="Select and import winners from other cities/rounds"
                                        >
                                            🪄 Import Winners
                                        </button>
                                    )}
                                    {roundDetails.is_finale ? (
                                        <button
                                            onClick={() => setShowSelectWinners(true)}
                                            className="btn-success text-sm"
                                        >
                                            🏆 Select Winners
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setShowPromote(true)}
                                            className="btn-admin text-sm"
                                            title={roundDetails.scored_count === 0 ? 'Upload scores before promoting' : 'Promote top participants to next round'}
                                        >
                                            Promote →
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Archive/Delete Actions */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                                <div className="flex items-center gap-2">
                                    {roundDetails.status === 'ARCHIVED' ? (
                                        <>
                                            <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">📦 Archived</span>
                                            <button
                                                onClick={handleUnarchiveRound}
                                                className="btn-outline text-sm text-green-400 border-green-400 hover:bg-green-400/10"
                                            >
                                                ♻️ Restore
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={handleArchiveRound}
                                            className="btn-outline text-sm text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
                                            title="Archive this round - data is preserved but round won't be counted"
                                        >
                                            📦 Archive
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleDeleteRound}
                                    className="btn-outline text-sm text-red-400 border-red-400 hover:bg-red-400/10"
                                    title="Permanently delete this round and all its data"
                                >
                                    🗑️ Delete Round
                                </button>
                            </div>

                            {/* Upload Progress */}
                            {uploadProgress && (
                                <div className={`mb-4 p-3 rounded-lg ${uploadProgress.startsWith('Error') ? 'bg-red-500/20 text-red-400' :
                                    uploadProgress.startsWith('Success') ? 'bg-green-500/20 text-green-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {uploadProgress}
                                </div>
                            )}

                            {/* Search Bar for Participants */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="🔍 Search participants by name, email, or MI ID..."
                                    value={roundParticipantSearch}
                                    onChange={e => setRoundParticipantSearch(e.target.value)}
                                    className="input-admin"
                                />
                            </div>

                            {/* Participants Table */}
                            <div className="overflow-x-auto">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Name</th>
                                            <th>MI ID</th>
                                            <th>Email</th>
                                            <th>Score</th>
                                            <th>Notes</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roundDetails.participants
                                            .filter(p => {
                                                const search = roundParticipantSearch.toLowerCase();
                                                if (!search) return true;
                                                return p.full_name.toLowerCase().includes(search) ||
                                                       (p.email && p.email.toLowerCase().includes(search)) ||
                                                       (p.mi_id && p.mi_id.toLowerCase().includes(search));
                                            })
                                            .map((p) => (
                                            <tr key={p.round_participation_id} className={p.is_winner ? 'bg-yellow-500/10' : ''}>
                                                <td className="font-medium text-white">
                                                    {p.is_winner && (
                                                        <span className="mr-1">
                                                            {p.winner_position === 1 ? '🥇' : p.winner_position === 2 ? '🥈' : p.winner_position === 3 ? '🥉' : '🏅'}
                                                        </span>
                                                    )}
                                                    {p.rank_in_round || '-'}
                                                </td>
                                                <td className="text-white">{p.full_name}</td>
                                                <td className="text-gray-300 font-mono text-xs">{p.mi_id || '-'}</td>
                                                <td className="text-gray-400 text-sm">{p.email}</td>
                                                <td>
                                                    {editingScore === p.round_participation_id ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            defaultValue={p.score || ''}
                                                            className="input-admin w-20 py-1"
                                                            onBlur={(e) => handleScoreUpdate(p.round_participation_id, e.target.value, p.notes)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleScoreUpdate(p.round_participation_id, e.target.value, p.notes);
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    setEditingScore(null);
                                                                }
                                                            }}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span
                                                            onClick={() => setEditingScore(p.round_participation_id)}
                                                            className={`cursor-pointer hover:text-blue-400 ${p.score === null ? 'text-gray-500 italic' : ''}`}
                                                            title="Click to edit score"
                                                        >
                                                            {p.score !== null ? p.score : '+ Add Score'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-gray-400 text-sm max-w-[200px] truncate">
                                                    {p.notes || '-'}
                                                </td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setEditingScore(p.round_participation_id)}
                                                            className={`${p.score === null ? 'text-yellow-400 hover:text-yellow-300' : 'text-blue-400 hover:text-blue-300'} text-sm`}
                                                        >
                                                            {p.score === null ? '+ Score' : 'Edit'}
                                                        </button>
                                                        {!roundDetails.is_finale && (
                                                            <button
                                                                onClick={() => handlePromoteIndividual(p.participation_id, p.full_name)}
                                                                className="text-green-400 hover:text-green-300 text-sm"
                                                                title="Promote to next round"
                                                            >
                                                                Promote →
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemoveParticipant(p.participation_id, p.full_name)}
                                                            className="text-red-400 hover:text-red-300 text-sm"
                                                            title="Remove from this round"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {roundDetails.participants.filter(p => {
                                            const search = roundParticipantSearch.toLowerCase();
                                            if (!search) return true;
                                            return p.full_name.toLowerCase().includes(search) ||
                                                   (p.email && p.email.toLowerCase().includes(search)) ||
                                                   (p.mi_id && p.mi_id.toLowerCase().includes(search));
                                        }).length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="text-center text-gray-500 py-8">
                                                    {roundParticipantSearch ? 'No participants match your search.' : 'No participants in this round yet.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="admin-card p-8 text-center text-gray-500">
                            Select a round to view details
                        </div>
                    )}
                </div>
            </div>

            {/* Create Round Modal */}
            {showCreateRound && (
                <div className="modal-overlay" onClick={() => setShowCreateRound(false)}>
                    <div className="modal-content p-6 max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-4">Create Round</h2>
                        <form onSubmit={handleCreateRound} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">City</label>
                                <select
                                    value={newRound.city_id}
                                    onChange={e => handleCityChange(e.target.value)}
                                    className="input-admin"
                                    required
                                >
                                    <option value="">Select city</option>
                                    {competition?.cities?.map(c => (
                                        <option key={c.city_id} value={c.city_id}>{c.city_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Round Name</label>
                                <input
                                    type="text"
                                    value={newRound.name}
                                    onChange={e => setNewRound({ ...newRound, name: e.target.value })}
                                    className="input-admin"
                                    placeholder="e.g., Audition, Semi-Final, Finale"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Round Number (auto-assigned based on city)</label>
                                <input
                                    type="number"
                                    value={newRound.round_number}
                                    className="input-admin bg-gray-700 cursor-not-allowed"
                                    min="1"
                                    readOnly
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {newRound.city_id ? `Next round for this city is Round ${newRound.round_number}` : 'Select a city first'}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_finale"
                                        checked={newRound.is_finale}
                                        onChange={e => setNewRound({ ...newRound, is_finale: e.target.checked })}
                                        className="w-4 h-4"
                                    />
                                    <label htmlFor="is_finale" className="text-gray-300">This is a finale round (winners can be selected)</label>
                                </div>
                            </div>
                            {newRound.is_finale && (
                                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400">
                                    🏆 <strong>Finale Round:</strong> After uploading scores, you can select winners from this round. Winners will be added to competition results.
                                </div>
                            )}
                            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm text-purple-400">
                                💡 <strong>Grand Finals Setup:</strong>
                                <ol className="mt-2 ml-4 list-decimal space-y-1">
                                    <li>Go to Competitions → Add City → Create "IIT Bombay - Grand Finals"</li>
                                    <li>Create a finale round for that city (check "finale round" above)</li>
                                    <li>Click "Import Winners" to bring in all city finalists</li>
                                    <li>Upload scores and select final winners</li>
                                </ol>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-admin">Create Round</button>
                                <button type="button" onClick={() => setShowCreateRound(false)} className="btn-outline">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Promote Modal */}
            {showPromote && (
                <div className="modal-overlay" onClick={() => setShowPromote(false)}>
                    <div className="modal-content p-6 max-w-sm" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-4">Promote to Next Round</h2>
                        <p className="text-gray-400 mb-2">
                            Select how many top participants to promote to the next round.
                        </p>
                        {roundDetails?.scored_count === 0 && (
                            <div className="mb-4 p-3 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm">
                                ⚠️ No scores uploaded yet. Upload scores before promoting.
                            </div>
                        )}
                        <div className="mb-2 p-3 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                            ℹ️ Make sure the next round (Round {roundDetails?.round_number + 1}) exists for this city before promoting.
                        </div>
                        <div className="mb-4 mt-4">
                            <label className="block text-sm text-gray-400 mb-1">
                                Number of participants (max: {roundDetails?.scored_count || 0})
                            </label>
                            <input
                                type="number"
                                value={promoteCount}
                                onChange={e => setPromoteCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                className="input-admin"
                                min="1"
                                max={roundDetails?.scored_count || 1}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={handlePromote} 
                                className="btn-admin"
                                disabled={roundDetails?.scored_count === 0}
                            >
                                Promote
                            </button>
                            <button onClick={() => setShowPromote(false)} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Errors Modal */}
            {showUploadErrorsModal && (
                <div className="modal-overlay" onClick={() => setShowUploadErrorsModal(false)}>
                    <div className="modal-content p-6 max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-2">Upload Errors</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            The following rows could not be processed:
                        </p>
                        
                        <div className="flex-1 overflow-y-auto mb-4 bg-gray-800/50 rounded-lg p-4">
                            <ul className="space-y-2 text-sm">
                                {uploadErrors && uploadErrors.map((error, idx) => (
                                    <li key={idx} className="text-red-400 flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">❌</span>
                                        <span>{error}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowUploadErrorsModal(false)} 
                                className="btn-admin"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Participant Modal */}
            {showAddParticipant && (
                <div className="modal-overlay" onClick={() => setShowAddParticipant(false)}>
                    <div className="modal-content p-6 max-w-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-2">Add Participant to Round</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Manually add a participant to this round (even without scores from previous rounds)
                        </p>
                        
                        {/* Search Bar */}
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="🔍 Search by name, email, or MI ID..."
                                value={participantSearch}
                                onChange={e => setParticipantSearch(e.target.value)}
                                className="input-admin"
                                autoFocus
                            />
                        </div>

                        {/* Participant List */}
                        <div className="mb-4 max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
                            {eligibleParticipants
                                .filter(p => {
                                    const search = participantSearch.toLowerCase();
                                    return p.full_name.toLowerCase().includes(search) ||
                                           (p.email && p.email.toLowerCase().includes(search)) ||
                                           (p.mi_id && p.mi_id.toLowerCase().includes(search));
                                })
                                .map(p => (
                                    <button
                                        key={p.participation_id}
                                        onClick={() => setSelectedParticipant(p.participation_id.toString())}
                                        className={`w-full text-left p-3 border-b border-gray-700 transition-colors ${
                                            selectedParticipant === p.participation_id.toString()
                                                ? 'bg-blue-600/30 border-l-4 border-l-blue-500'
                                                : 'hover:bg-gray-700/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-white">{p.full_name}</div>
                                                <div className="text-sm text-gray-400">
                                                    {p.mi_id || p.email} • {p.city_name}
                                                    {p.is_past_winner && <span className="ml-2 text-yellow-400">🏆 Past Winner</span>}
                                                </div>
                                            </div>
                                            {selectedParticipant === p.participation_id.toString() && (
                                                <span className="text-blue-400">✓ Selected</span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            }
                        </div>
                        
                        {eligibleParticipants.filter(p => {
                            const search = participantSearch.toLowerCase();
                            return p.full_name.toLowerCase().includes(search) ||
                                   (p.email && p.email.toLowerCase().includes(search)) ||
                                   (p.mi_id && p.mi_id.toLowerCase().includes(search));
                        }).length === 0 && (
                            <p className="text-gray-500 mb-4 text-center py-8">
                                {participantSearch ? 'No participants match your search.' : 'No eligible participants found.'}
                            </p>
                        )}
                        
                        <div className="flex gap-3">
                            <button
                                onClick={handleAddParticipant}
                                className="btn-admin"
                                disabled={!selectedParticipant}
                            >
                                Add Participant
                            </button>
                            <button onClick={() => setShowAddParticipant(false)} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Select Winners Modal */}
            {/* Import Winners Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal-content p-6 max-w-2xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-4">🪄 Import Winners</h2>
                        <p className="text-gray-400 mb-4">
                            Select how many winners to import from each city. Winners are ordered by score.
                        </p>
                        
                        {availableCityWinners.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                No winners available to import from other rounds.
                            </div>
                        ) : (
                            <div className="space-y-4 mb-6">
                                {availableCityWinners.map(city => (
                                    <div key={city.city_id} className="bg-gray-800/50 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-white font-semibold">{city.city_name}</h3>
                                                <p className="text-gray-400 text-sm">{city.winner_count} winner(s) available</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-gray-300 text-sm">Import:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={city.winner_count}
                                                    value={importSelections[city.city_id] || 0}
                                                    onChange={(e) => setImportSelections(prev => ({
                                                        ...prev,
                                                        [city.city_id]: Math.min(parseInt(e.target.value) || 0, city.winner_count)
                                                    }))}
                                                    className="input-admin w-20 text-center py-1"
                                                />
                                                <span className="text-gray-400 text-sm">/ {city.winner_count}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Preview winners */}
                                        <div className="grid gap-2 mt-2">
                                            {city.winners.slice(0, importSelections[city.city_id] || 0).map((winner, idx) => (
                                                <div key={winner.user_id} className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded px-3 py-2 text-sm">
                                                    <span className="text-white">
                                                        {idx + 1}. {winner.full_name}
                                                    </span>
                                                    <span className="text-green-400">Score: {winner.score}</span>
                                                </div>
                                            ))}
                                            {(importSelections[city.city_id] || 0) > 0 && city.winners.length > (importSelections[city.city_id] || 0) && (
                                                <div className="text-gray-500 text-xs text-center">
                                                    {city.winner_count - (importSelections[city.city_id] || 0)} more winner(s) not selected
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex gap-3 border-t border-gray-700 pt-4">
                            <button
                                onClick={handleImportSelectedWinners}
                                className="btn-admin"
                                disabled={Object.values(importSelections).every(v => !v || v === 0)}
                            >
                                Import {Object.values(importSelections).reduce((sum, v) => sum + (parseInt(v) || 0), 0)} Winners
                            </button>
                            <button onClick={() => setShowImportModal(false)} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showSelectWinners && roundDetails && (
                <div className="modal-overlay" onClick={() => setShowSelectWinners(false)}>
                    <div className="modal-content p-6 max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-4">🏆 Select Winners</h2>
                        <p className="text-gray-400 mb-4">
                            Click on participants to select as winners. Assign their positions.
                        </p>
                        <div className="space-y-2 mb-4">
                            {roundDetails.participants
                                .filter(p => p.score !== null)
                                .sort((a, b) => (b.score || 0) - (a.score || 0))
                                .map((p, index) => {
                                    const isSelected = winners.some(w => w.round_participation_id === p.round_participation_id);
                                    const selectedPosition = winners.find(w => w.round_participation_id === p.round_participation_id)?.position;
                                    return (
                                        <div
                                            key={p.round_participation_id}
                                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${isSelected ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-gray-800/50 hover:bg-gray-700/50'
                                                }`}
                                            onClick={() => toggleWinner(p.round_participation_id, index + 1)}
                                        >
                                            <div>
                                                <span className="text-white font-medium">{p.full_name}</span>
                                                <span className="text-gray-400 ml-2">Score: {p.score}</span>
                                            </div>
                                            {isSelected && (
                                                <select
                                                    value={selectedPosition}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        setWinners(prev => prev.map(w =>
                                                            w.round_participation_id === p.round_participation_id
                                                                ? { ...w, position: parseInt(e.target.value) }
                                                                : w
                                                        ));
                                                    }}
                                                    onClick={e => e.stopPropagation()}
                                                    className="input-admin w-24 py-1"
                                                >
                                                    <option value="1">🥇 1st</option>
                                                    <option value="2">🥈 2nd</option>
                                                    <option value="3">🥉 3rd</option>
                                                    <option value="4">4th</option>
                                                    <option value="5">5th</option>
                                                </select>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSelectWinners}
                                className="btn-success"
                                disabled={winners.length === 0}
                            >
                                Confirm Winners ({winners.length})
                            </button>
                            <button onClick={() => setShowSelectWinners(false)} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoundManagement;
