import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { competitionsAPI } from '../api';

const CompetitionDashboard = () => {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, [competitionId]);

    const loadDashboard = async () => {
        try {
            const response = await competitionsAPI.getDashboard(competitionId);
            setDashboard(response.data.data);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div className="admin-card p-8 text-center text-gray-500">
                Competition not found
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
                    <h1 className="text-xl sm:text-2xl font-bold text-white">{dashboard.name} - Dashboard</h1>
                    <span className={`text-sm px-2 py-1 rounded ${
                        dashboard.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                        dashboard.status === 'REGISTRATION_OPEN' ? 'bg-blue-500/20 text-blue-400' :
                        dashboard.status === 'ACTIVE' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                    }`}>
                        {dashboard.status?.replace(/_/g, ' ')}
                    </span>
                </div>
                <button
                    onClick={() => navigate(`/competitions/${competitionId}/rounds`)}
                    className="btn-admin"
                >
                    Manage Rounds
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
                <div className="admin-card p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-400">{dashboard.stats.total_participants}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Participants</div>
                </div>
                <div className="admin-card p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-400">{dashboard.stats.total_cities}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Cities</div>
                </div>
                <div className="admin-card p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-indigo-400">{dashboard.stats.total_rounds}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Rounds</div>
                </div>
                <div className="admin-card p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-amber-400">{dashboard.stats.total_winners}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Winners</div>
                </div>
                <div className="admin-card p-3 sm:p-4 text-center col-span-2 sm:col-span-1">
                    <div className="text-2xl sm:text-3xl font-bold text-green-400">{dashboard.stats.cities_completed}/{dashboard.stats.total_cities}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Cities Completed</div>
                </div>
            </div>

            {/* City-wise breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {Object.entries(dashboard.rounds_by_city).map(([cityName, cityData]) => (
                    <div key={cityName} className="admin-card p-5">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            📍 {cityName}
                            {cityData.rounds.some(r => r.is_finale && r.status === 'COMPLETED') && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Completed</span>
                            )}
                        </h3>

                        {/* Rounds */}
                        <div className="mb-4">
                            <h4 className="text-sm text-gray-400 mb-2">Rounds</h4>
                            <div className="space-y-2">
                                {cityData.rounds.map(round => (
                                    <div key={round.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-gray-800/50 rounded">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-white truncate">{round.name}</span>
                                            {round.is_finale && <span className="text-amber-400 flex-shrink-0">🏆</span>}
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
                                            <span className="text-gray-400">{round.participant_count} participants</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                round.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                                round.status === 'IN_PROGRESS' ? 'bg-yellow-500/20 text-yellow-400' :
                                                round.status === 'ARCHIVED' ? 'bg-gray-600/20 text-gray-500' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {round.status === 'ARCHIVED' ? '📦 Archived' : round.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Winners */}
                        {cityData.winners.length > 0 && (
                            <div>
                                <h4 className="text-sm text-gray-400 mb-2">Winners</h4>
                                <div className="space-y-2">
                                    {cityData.winners.map((winner, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-gradient-to-r from-amber-500/10 to-transparent rounded">
                                            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold">
                                                {winner.position === 1 ? '🥇' : winner.position === 2 ? '🥈' : winner.position === 3 ? '🥉' : `#${winner.position}`}
                                            </span>
                                            <div>
                                                <div className="text-white font-medium">{winner.full_name}</div>
                                                <div className="text-xs text-gray-400">{winner.mi_id} • Score: {winner.score}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* All Winners Section */}
            {dashboard.all_winners.length > 0 && (
                <div className="admin-card p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">🏆 All Winners</h3>
                    <div className="overflow-x-auto">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Position</th>
                                    <th>Name</th>
                                    <th>MI ID</th>
                                    <th>Email</th>
                                    <th>City</th>
                                    <th>Round</th>
                                    <th>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboard.all_winners.map((winner, idx) => (
                                    <tr key={idx}>
                                        <td className="text-center">
                                            {winner.position === 1 ? '🥇' : winner.position === 2 ? '🥈' : winner.position === 3 ? '🥉' : `#${winner.position}`}
                                        </td>
                                        <td className="text-white font-medium">{winner.full_name}</td>
                                        <td className="font-mono text-sm text-gray-300">{winner.mi_id}</td>
                                        <td className="text-gray-400 text-sm">{winner.email}</td>
                                        <td>{winner.city_name}</td>
                                        <td>{winner.round_name}</td>
                                        <td className="font-medium">{winner.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitionDashboard;
