import { useState, useEffect } from 'react';
import { leaderboardAPI, competitionsAPI } from '../api';
import Loading from '../components/ui/Loading';
import LightRays from '../components/ui/LightRays';
import Particles from '../components/ui/Particles';
import TextRewind from '../components/ui/TextRewind';

const Leaderboard = () => {
    const [data, setData] = useState({ stats: null, topPerformers: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, by-city, by-competition, rounds

    // City leaderboard state
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState(null);
    const [cityLeaderboard, setCityLeaderboard] = useState([]);
    const [cityLoading, setCityLoading] = useState(false);

    // Competition/Rounds state
    const [competitions, setCompetitions] = useState([]);
    const [selectedCompetition, setSelectedCompetition] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [selectedRound, setSelectedRound] = useState(null);
    const [roundLeaderboard, setRoundLeaderboard] = useState(null);
    const [winners, setWinners] = useState([]);
    const [roundLoading, setRoundLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [leaderboardRes, citiesRes, competitionsRes] = await Promise.all([
                leaderboardAPI.get(),
                competitionsAPI.getCities(),
                leaderboardAPI.getCompetitionsWithRounds()
            ]);
            setData(leaderboardRes.data.data);
            setCities(citiesRes.data.data || []);
            setCompetitions(competitionsRes.data.data || []);
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCityLeaderboard = async (cityId) => {
        setSelectedCity(cityId);
        setCityLoading(true);
        try {
            const response = await leaderboardAPI.byCity(cityId);
            setCityLeaderboard(response.data.data || []);
        } catch (error) {
            console.error('Failed to load city leaderboard:', error);
        } finally {
            setCityLoading(false);
        }
    };

    const loadCompetitionRounds = async (competitionId) => {
        setSelectedCompetition(competitionId);
        setSelectedRound(null);
        setRoundLeaderboard(null);
        setRoundLoading(true);
        try {
            const [roundsRes, winnersRes] = await Promise.all([
                leaderboardAPI.getCompetitionRounds(competitionId),
                leaderboardAPI.getCompetitionWinners(competitionId)
            ]);
            setRounds(roundsRes.data.data || []);
            setWinners(winnersRes.data.data || []);
        } catch (error) {
            console.error('Failed to load competition rounds:', error);
        } finally {
            setRoundLoading(false);
        }
    };

    const loadRoundLeaderboard = async (roundId) => {
        setSelectedRound(roundId);
        setRoundLoading(true);
        try {
            const response = await leaderboardAPI.getRoundLeaderboard(roundId);
            setRoundLeaderboard(response.data.data);
        } catch (error) {
            console.error('Failed to load round leaderboard:', error);
        } finally {
            setRoundLoading(false);
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
        return <Loading />;
    }

    return (
        <>
            {/* Light Rays on Top */}
            <div className="fixed !top-0 left-0 right-0 bottom-0 z-50 pointer-events-none">
                <LightRays
                    raysOrigin="top-center"
                    raysColor="#ffffff"
                    raysSpeed={1}
                    lightSpread={isMobile ? 2.5 : 0.5}
                    rayLength={isMobile ? 6 : 3}
                    followMouse={true}
                    mouseInfluence={0.1}
                    noiseAmount={0}
                    distortion={0}
                    pulsating={false}
                    fadeDistance={isMobile ? 0.6 : 1}
                    saturation={1}
                />
            </div>

            {/* Particles Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <Particles
                    particleCount={200}
                    particleSpread={10}
                    speed={0.1}
                    particleColors={['#ffffff', '#ffffff', '#ffffff']}
                    alphaParticles={true}
                    particleBaseSize={100}
                    sizeRandomness={1}
                    cameraDistance={20}
                />
            </div>

            {/* TextRewind Background Text */}
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, pointerEvents: 'none', opacity: 0.2 }}>
                <TextRewind text="MOOD INDIGO" />
            </div>

            <div className="animate-fadeIn relative bg-black min-h-screen -mt-24 md:-mt-28">
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-6 pt-24 md:pt-28">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 uppercase tracking-widest">LEADERBOARD</h1>
                        <p className="text-sm sm:text-base text-white/60">Track scores and rankings across all competitions</p>
                    </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {['overview', 'by-city', 'by-competition'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${activeTab === tab
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        {tab === 'overview' && '📊 Overview'}
                        {tab === 'by-city' && '🏙️ By City'}
                        {tab === 'by-competition' && '🎯 By Competition'}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <>
                    {/* Stats Overview */}
                    {data.stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="p-4 sm:p-5 text-center rounded-lg bg-white/5 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                                <div className="text-2xl sm:text-3xl font-bold text-white">
                                    {data.stats.active_competitions}
                                </div>
                                <div className="text-xs sm:text-sm text-white/60 mt-1">Active Competitions</div>
                            </div>
                            <div className="p-4 sm:p-5 text-center rounded-lg bg-white/5 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                                <div className="text-2xl sm:text-3xl font-bold text-white">
                                    {data.stats.total_participations}
                                </div>
                                <div className="text-xs sm:text-sm text-white/60 mt-1">Total Participants</div>
                            </div>
                            <div className="p-4 sm:p-5 text-center rounded-lg bg-white/5 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                                <div className="text-2xl sm:text-3xl font-bold text-white">
                                    {data.stats.total_winners}
                                </div>
                                <div className="text-xs sm:text-sm text-white/60 mt-1">Winners</div>
                            </div>
                            <div className="p-4 sm:p-5 text-center rounded-lg bg-white/5 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                                <div className="text-2xl sm:text-3xl font-bold text-white">
                                    {data.stats.active_cities}
                                </div>
                                <div className="text-xs sm:text-sm text-white/60 mt-1">Cities</div>
                            </div>
                        </div>
                    )}

                    {/* Top Performers */}
                    <div className="p-4 sm:p-6 rounded-lg">
                        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-white">🏆 Top Performers</h2>

                        {data.topPerformers.length === 0 ? (
                            <div className="text-center py-8 text-white/60">
                                No results yet. Be the first to win!
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.topPerformers.map((performer, index) => (
                                    <div
                                        key={performer.id}
                                        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 rounded-lg hover:bg-white/10 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all"
                                    >
                                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${index === 0 ? 'bg-white text-black' :
                                                index === 1 ? 'bg-white/80 text-black' :
                                                    index === 2 ? 'bg-white/60 text-black' :
                                                        'bg-white/20 text-white'
                                            }`}>
                                            {index + 1}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white text-sm sm:text-base truncate">{performer.full_name}</div>
                                            <div className="text-xs sm:text-sm text-white/60">{performer.mi_id}</div>
                                            <div className="text-xs text-white/40">
                                                {performer.total_participations} competitions
                                            </div>
                                        </div>

                                        <div className="flex gap-3 sm:gap-4 text-center">
                                            <div>
                                                <div className="text-lg sm:text-xl font-bold text-white">{performer.wins}</div>
                                                <div className="text-xs text-white/50">Wins</div>
                                            </div>
                                            <div>
                                                <div className="text-lg sm:text-xl font-bold text-white">{performer.first_places}</div>
                                                <div className="text-xs text-white/50">1st Places</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* By City Tab */}
            {activeTab === 'by-city' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* City List */}
                    <div className="p-4 rounded-lg">
                        <h3 className="font-semibold mb-4 text-white text-sm sm:text-base">Select City</h3>
                        <div className="space-y-2">
                            {cities.map(city => (
                                <button
                                    key={city.id}
                                    onClick={() => loadCityLeaderboard(city.id)}
                                    className={`w-full text-left p-3 rounded-lg transition-all text-sm sm:text-base ${selectedCity === city.id
                                            ? 'bg-white text-black'
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                >
                                    {city.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* City Leaderboard */}
                    <div className="lg:col-span-2 p-4 sm:p-6 rounded-lg">
                        {!selectedCity ? (
                            <div className="text-center text-white/60 py-12">
                                Select a city to view leaderboard
                            </div>
                        ) : cityLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                        ) : (
                            <>
                                <h3 className="font-semibold mb-4 text-white text-sm sm:text-base">
                                    {cities.find(c => c.id === selectedCity)?.name} Winners
                                </h3>
                                {cityLeaderboard.length === 0 ? (
                                    <div className="text-center text-white/60 py-8">
                                        No results yet for this city
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-left text-white/60 text-xs sm:text-sm border-b border-white/20">
                                                    <th className="py-3">Position</th>
                                                    <th>MI ID</th>
                                                    <th>Name</th>
                                                    <th className="hidden sm:table-cell">Competition</th>
                                                    <th className="hidden md:table-cell">Round</th>
                                                    <th>Score</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cityLeaderboard.map((entry, i) => (
                                                    <tr key={i} className="border-b border-white/10 text-xs sm:text-sm">
                                                        <td className="py-3 text-white">
                                                            {entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : '🏅'}
                                                            <span className="ml-1">{entry.position || '-'}</span>
                                                        </td>
                                                        <td className="text-white/60">{entry.mi_id || '-'}</td>
                                                        <td className="text-white">{entry.full_name}</td>
                                                        <td className="text-white/60 hidden sm:table-cell">{entry.competition_name}</td>
                                                        <td className="text-white/60 hidden md:table-cell">{entry.round_name || '-'}</td>
                                                        <td className="text-white font-medium">{entry.score ?? '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* By Competition Tab */}
            {activeTab === 'by-competition' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
                    {/* Competition List */}
                    <div className="p-4 rounded-lg">
                        <h3 className="font-semibold mb-4 text-white text-sm sm:text-base">Select Competition</h3>
                        <div className="space-y-2">
                            {competitions.length === 0 ? (
                                <div className="text-white/60 text-sm py-4">
                                    No competitions available
                                </div>
                            ) : (
                                competitions.map(comp => (
                                    <button
                                        key={comp.id}
                                        onClick={() => loadCompetitionRounds(comp.id)}
                                        className={`w-full text-left p-3 rounded-lg transition-all text-sm ${selectedCompetition === comp.id
                                                ? 'bg-white text-black'
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                            }`}
                                    >
                                        <div className="font-medium">{comp.name}</div>
                                        <div className={`text-xs mt-1 ${selectedCompetition === comp.id ? 'text-black/60' : 'text-white/60'}`}>
                                            {comp.round_count > 0 ? `${comp.round_count} rounds` : `${comp.participant_count || 0} participants`}
                                            {comp.has_finale_winners > 0 && ' • 🏆 Complete'}
                                            <span className={`ml-2 ${selectedCompetition === comp.id ? '' : (comp.status === 'ACTIVE' ? 'text-white' : comp.status === 'COMPLETED' ? 'text-white/80' : 'text-white/50')}`}>
                                                {comp.status}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Rounds & Winners */}
                    <div className="lg:col-span-3">
                        {!selectedCompetition ? (
                            <div className="p-8 sm:p-12 text-center text-white/60 rounded-lg">
                                Select a competition to view rounds and scores
                            </div>
                        ) : roundLoading && !roundLeaderboard ? (
                            <div className="p-8 sm:p-12 flex justify-center rounded-lg">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                        ) : rounds.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center text-white/60 rounded-lg">
                                <div className="text-4xl mb-4">📋</div>
                                <p>No rounds have been created for this competition yet.</p>
                                <p className="text-sm mt-2">Check back later for updates!</p>
                            </div>
                        ) : (
                            <div className="space-y-4 sm:space-y-6">
                                {/* Winners Banner */}
                                {winners.length > 0 && (
                                    <div className="p-4 sm:p-6 rounded-lg bg-white/10 border border-white/20 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                                        <h3 className="text-base sm:text-lg font-semibold mb-4 text-white">🏆 Grand Finale Winners</h3>
                                        <div className="flex flex-wrap gap-3 sm:gap-4">
                                            {winners.map((w, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-white/10 p-3 rounded-lg">
                                                    <span className="text-xl sm:text-2xl">
                                                        {w.winner_position === 1 ? '🥇' : w.winner_position === 2 ? '🥈' : w.winner_position === 3 ? '🥉' : '🏅'}
                                                    </span>
                                                    <div>
                                                        <div className="font-medium text-white text-sm">{w.full_name}</div>
                                                        <div className="text-xs text-white/60">{w.mi_id}</div>
                                                        <div className="text-xs text-white/40">{w.city_name}</div>
                                                    </div>
                                                    {w.score && <span className="text-white font-bold ml-2">{w.score}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Rounds by City */}
                                {Object.entries(roundsByCity).map(([cityName, cityRounds]) => (
                                    <div key={cityName} className="p-4 sm:p-5 rounded-lg bg-white/5 hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                                        <h4 className="font-semibold mb-3 text-white text-sm sm:text-base">📍 {cityName}</h4>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {cityRounds.sort((a, b) => a.round_number - b.round_number).map(round => (
                                                <button
                                                    key={round.id}
                                                    onClick={() => loadRoundLeaderboard(round.id)}
                                                    className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedRound === round.id
                                                            ? 'bg-white text-black'
                                                            : 'bg-white/10 text-white hover:bg-white/20'
                                                        }`}
                                                >
                                                    {round.name}
                                                    {round.is_finale && ' 🏆'}
                                                    <span className={`ml-2 text-xs ${selectedRound === round.id ? 'text-black/60' : (round.status === 'COMPLETED' ? 'text-white/80' : 'text-white/50')}`}>
                                                        ({round.participant_count})
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Round Leaderboard */}
                                        {selectedRound && roundLeaderboard && cityRounds.some(r => r.id === selectedRound) && (
                                            <div className="bg-white/5 rounded-lg p-4 mt-4">
                                                <h5 className="font-medium mb-3 text-white text-sm">{roundLeaderboard.name} - Scores</h5>
                                                {roundLoading ? (
                                                    <div className="flex justify-center py-4">
                                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    </div>
                                                ) : roundLeaderboard.leaderboard?.length === 0 ? (
                                                    <div className="text-white/60 text-sm">No scores recorded yet</div>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs sm:text-sm">
                                                            <thead>
                                                                <tr className="text-left text-white/60 border-b border-white/20">
                                                                    <th className="py-2 w-16">Rank</th>
                                                                    <th>MI ID</th>
                                                                    <th>Name</th>
                                                                    <th className="text-right">Score</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {roundLeaderboard.leaderboard.map((entry, i) => (
                                                                    <tr key={i} className={`border-b border-white/10 ${entry.is_winner ? 'bg-white/10' : ''}`}>
                                                                        <td className="py-2 text-white">
                                                                            {entry.is_winner && (
                                                                                <span className="mr-1">
                                                                                    {entry.winner_position === 1 ? '🥇' : entry.winner_position === 2 ? '🥈' : entry.winner_position === 3 ? '🥉' : '🏅'}
                                                                                </span>
                                                                            )}
                                                                            {entry.rank_in_round || '-'}
                                                                        </td>
                                                                        <td className="text-white/60">{entry.mi_id || '-'}</td>
                                                                        <td className="text-white">{entry.full_name}</td>
                                                                        <td className="text-right font-medium text-white">
                                                                            {entry.score ?? '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
                </div>
            </div>
        </>
    );
};

export default Leaderboard;
