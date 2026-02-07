import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { competitionsAPI } from '../api';
import Loading from '../components/ui/Loading';
import { useAuth } from '../context/AuthContext';
import LightRays from '../components/ui/LightRays';
import Particles from '../components/ui/Particles';
import TextRewind from '../components/ui/TextRewind';

const CompetitionDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [competition, setCompetition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState(null);
    const [registering, setRegistering] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isRegistered, setIsRegistered] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        loadCompetition();
    }, [id]);

    const loadCompetition = async () => {
        try {
            const response = await competitionsAPI.getDetails(id);
            setCompetition(response.data.data);
            // Check if user is already registered
            if (user) {
                try {
                    const regsResponse = await competitionsAPI.getMyRegistrations();
                    const isAlreadyRegistered = regsResponse.data.data.some(r => r.competition_id === parseInt(id));
                    setIsRegistered(isAlreadyRegistered);
                } catch (e) {
                    console.log('Could not check registrations:', e);
                }
            }
        } catch (error) {
            console.error('Failed to load competition:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (!selectedCity) {
            setMessage({ type: 'error', text: 'Please select a city' });
            return;
        }
        setRegistering(true);
        setMessage({ type: '', text: '' });
        try {
            await competitionsAPI.register(id, selectedCity);
            setMessage({ type: 'success', text: 'Successfully registered!' });
            setIsRegistered(true);
            loadCompetition(); // Refresh to update participant counts
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Registration failed' });
        } finally {
            setRegistering(false);
        }
    };

    // Calculate countdown to nearest event
    const getCountdown = () => {
        if (!competition?.cities) return null;
        const eventDates = competition.cities
            .filter(c => c.event_date)
            .map(c => new Date(c.event_date))
            .filter(d => d > new Date())
            .sort((a, b) => a - b);

        if (eventDates.length === 0) return null;

        const nextEvent = eventDates[0];
        const diff = nextEvent - new Date();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        return { days, hours, date: nextEvent };
    };

    const countdown = competition ? getCountdown() : null;

    if (loading) {
        return <Loading />;
    }

    if (!competition) {
        return (
            <div className="text-center py-16">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold mb-2">Competition Not Found</h2>
                <button onClick={() => navigate('/competitions')} className="btn-primary mt-4">
                    Browse Competitions
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn relative bg-black min-h-screen -mt-24 md:-mt-28">
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
            <div className="fixed !top-0 inset-0 z-0 pointer-events-none">
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

            <div className="relative z-10 max-w-4xl mx-auto pt-24 md:pt-28">
            {/* Back Button */}
            <button onClick={() => navigate('/competitions')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Competitions
            </button>

            {/* Header */}
            <div className="p-6 sm:p-8 mb-6 rounded-lg">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-white px-2 py-0.5 sm:py-1 mb-3 inline-block">
                            {competition.status?.replace(/_/g, ' ')}
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">{competition.name}</h1>
                        <p className="text-white/60">{competition.description}</p>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-white/20">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{competition.cities?.length || 0}</div>
                        <div className="text-sm text-white/60">Cities</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{competition.total_participants || 0}</div>
                        <div className="text-sm text-white/60">Participants</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{competition.winners?.length || 0}</div>
                        <div className="text-sm text-white/60">Winners</div>
                    </div>
                    {countdown && (
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">
                                {countdown.days}d {countdown.hours}h
                            </div>
                            <div className="text-sm text-white/60">Until Next Event</div>
                        </div>
                    )}
                </div>

                {/* Countdown Banner */}
                {countdown && (
                    <div className="mt-6 p-4 rounded-lg border border-white/20">
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <div className="font-semibold text-white">Next event on {countdown.date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                <div className="text-sm text-white/60">{countdown.days} days and {countdown.hours} hours remaining</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Message */}
            {message.text && (
                <div className={`mb-6 p-4 rounded-lg border ${message.type === 'success' ? 'border-white/30 text-white' : 'border-white/30 text-white'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {/* Cities List */}
                <div className="p-6 rounded-lg">
                    <h3 className="text-xl font-semibold mb-4 text-white">Event Locations</h3>
                    <div className="space-y-3">
                        {competition.cities?.map((city) => (
                            <div
                                key={city.city_id}
                                onClick={() => competition.registration_open && setSelectedCity(city.city_id)}
                                className={`p-4 rounded-lg border transition-all cursor-pointer ${selectedCity === city.city_id
                                        ? 'border-white bg-white/5'
                                        : 'border-white/20 hover:border-white/40'
                                    } ${!competition.registration_open ? 'cursor-default' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-white">{city.city_name}</div>
                                        <div className="text-sm text-white/60">
                                            {city.event_date
                                                ? new Date(city.event_date).toLocaleDateString('en-IN', { dateStyle: 'long' })
                                                : 'Date TBA'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-white">{city.participant_count || 0}</div>
                                        <div className="text-xs text-white/60">registered</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {competition.registration_open && !isRegistered && (
                        <button
                            onClick={handleRegister}
                            disabled={registering || !selectedCity}
                            className="w-full mt-6 px-6 py-3 bg-white text-black font-bold uppercase tracking-wider hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {registering ? 'Registering...' : user ? 'Register Now' : 'Login to Register'}
                        </button>
                    )}
                    {isRegistered && (
                        <div className="mt-6 p-4 rounded-lg border border-white/30 text-white text-center">
                            ✅ Successfully Registered!
                        </div>
                    )}
                </div>

                {/* Winners Section */}
                <div className="p-6 rounded-lg">
                    <h3 className="text-xl font-semibold mb-4 text-white">Winners</h3>
                    {competition.winners?.length > 0 ? (
                        <div className="space-y-3">
                            {competition.winners.map((winner, index) => (
                                <div key={index} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-white text-black">
                                        #{winner.position || (index + 1)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-white">{winner.full_name}</div>
                                        <div className="text-sm text-white/60">
                                            {winner.city_name}
                                            {winner.score && <span className="ml-2">• Score: {winner.score}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-white/60">
                            <div className="text-4xl mb-2">🏆</div>
                            <p>Winners will be announced after the competition</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Round-wise Results Section */}
            {competition.round_results && Object.keys(competition.round_results).length > 0 && (
                <div className="mt-6">
                    <h3 className="text-xl font-semibold mb-4 text-white">Round-wise Results</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {Object.entries(competition.round_results).map(([cityName, rounds]) => (
                            <div key={cityName} className="p-4 rounded-lg">
                                <h4 className="font-semibold text-lg mb-3 text-white">{cityName}</h4>
                                <div className="space-y-3">
                                    {rounds.sort((a, b) => a.round_number - b.round_number).map((round) => (
                                        <div key={round.round_id} className="bg-white/5 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-white">
                                                    {round.round_name}
                                                    {round.is_finale && ' 🏆'}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    round.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                                    round.status === 'ARCHIVED' ? 'bg-gray-600/20 text-gray-400' :
                                                    'border border-white/20 text-white'
                                                }`}>
                                                    {round.status === 'ARCHIVED' ? '📦 Archived' : round.status}
                                                </span>
                                            </div>
                                            {round.top_participants?.length > 0 ? (
                                                <div className="space-y-1">
                                                    {round.top_participants.slice(0, 3).map((p, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-sm">
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-slate-500">#{p.rank || idx + 1}</span>
                                                                <span>{p.full_name}</span>
                                                                {p.is_winner && <span className="text-yellow-400">🏅</span>}
                                                            </span>
                                                            {p.score && <span className="text-slate-400">{p.score}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-slate-500">No results yet</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}            </div>        </div>
    );
};

export default CompetitionDetails;
