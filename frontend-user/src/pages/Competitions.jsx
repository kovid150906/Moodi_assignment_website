import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { competitionsAPI } from '../api';
import LightRays from '../components/ui/LightRays';
import Particles from '../components/ui/Particles';
import Loading from '../components/ui/Loading';
import TextRewind from '../components/ui/TextRewind';

const Competitions = () => {
    const navigate = useNavigate();
    const [competitions, setCompetitions] = useState([]);
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(null);
    const [selectedCity, setSelectedCity] = useState({});
    const [message, setMessage] = useState({ type: '', text: '' });
    const [registeredComps, setRegisteredComps] = useState(new Set());

    // Filters
    const [search, setSearch] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showParticipatedOnly, setShowParticipatedOnly] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!hasLoaded) {
            loadCities();
            loadMyRegistrations();
            setHasLoaded(true);
        }
    }, [hasLoaded]);

    const loadMyRegistrations = async () => {
        try {
            const response = await competitionsAPI.getMyRegistrations();
            const regIds = new Set(response.data.data.map(r => r.competition_id));
            setRegisteredComps(regIds);
        } catch (error) {
            // User might not be logged in
            console.log('Could not load registrations:', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        loadCompetitions();
    }, [debouncedSearch, filterCity, filterStatus]);

    const loadCities = async () => {
        try {
            const response = await competitionsAPI.getCities();
            setCities(response.data.data);
        } catch (error) {
            console.error('Failed to load cities:', error);
        }
    };

    const loadCompetitions = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (debouncedSearch) filters.search = debouncedSearch;
            if (filterCity) filters.city_id = filterCity;
            if (filterStatus) filters.status = filterStatus;
            const response = await competitionsAPI.getAll(filters);
            setCompetitions(response.data.data);
        } catch (error) {
            console.error('Failed to load competitions:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter competitions by participated only if enabled
    const displayedCompetitions = showParticipatedOnly 
        ? competitions.filter(c => registeredComps.has(c.id))
        : competitions;

    const handleRegister = async (competitionId) => {
        const cityId = selectedCity[competitionId];
        if (!cityId) {
            setMessage({ type: 'error', text: 'Please select a city' });
            return;
        }

        setRegistering(competitionId);
        setMessage({ type: '', text: '' });

        try {
            await competitionsAPI.register(competitionId, cityId);
            setMessage({ type: 'success', text: 'Successfully registered!' });
            setRegisteredComps(prev => new Set([...prev, competitionId]));
            loadCompetitions();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Registration failed'
            });
        } finally {
            setRegistering(null);
        }
    };

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
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 uppercase tracking-widest">COMPETITIONS</h1>
                <p className="text-sm sm:text-base text-white/60">Browse and register for competitions</p>
            </div>

            {/* Search and Filter */}
            <div className="p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search competitions..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 px-4 py-2 bg-black text-white placeholder-white/50 border border-white/20 focus:border-white/40 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <select
                            value={filterCity}
                            onChange={(e) => setFilterCity(e.target.value)}
                            className="w-full px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none"
                        >
                            <option value="">All Cities</option>
                            {cities.map((city) => (
                                <option key={city.id} value={city.id}>{city.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full md:w-48">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none"
                        >
                            <option value="">All Status</option>
                            <option value="ACTIVE">Ongoing</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="participatedOnly"
                        checked={showParticipatedOnly}
                        onChange={(e) => setShowParticipatedOnly(e.target.checked)}
                        className="w-4 h-4 rounded"
                    />
                    <label htmlFor="participatedOnly" className="text-sm text-white/60">
                        Show only competitions I've participated in
                    </label>
                </div>
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {loading ? (
                <Loading />
            ) : displayedCompetitions.length === 0 ? (
                <div className="p-8 text-center rounded-lg">
                    <div className="text-5xl mb-4">🏆</div>
                    <h3 className="text-xl font-semibold mb-2 text-white">No Competitions Found</h3>
                    <p className="text-white/60">
                        {search || filterCity || filterStatus || showParticipatedOnly ? 'Try adjusting your filters' : 'Check back later for new competitions!'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:gap-6">
                    {displayedCompetitions.map((comp) => (
                        <div key={comp.id} className="p-4 sm:p-6 transition-all duration-300 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)] cursor-pointer rounded-lg">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                        <h3 className="text-lg sm:text-xl font-semibold text-white">{comp.name}</h3>
                                        <span className="text-xs font-bold uppercase tracking-wider text-white px-2 py-0.5 sm:py-1">
                                            {comp.status?.replace(/_/g, ' ')}
                                        </span>
                                        {registeredComps.has(comp.id) && (
                                            <span className="text-xs text-white px-2 py-0.5">
                                                ✓ Registered
                                            </span>
                                        )}
                                        {comp.total_participants > 0 && (
                                            <span className="text-sm text-white/60">
                                                ({comp.total_participants} registered)
                                            </span>
                                        )}
                                    </div>

                                    {comp.description && (
                                        <p className="text-sm sm:text-base text-white/60 mb-3 sm:mb-4 line-clamp-2">{comp.description}</p>
                                    )}

                                    <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-white/60">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {comp.cities?.length || 0} cities
                                        </div>
                                        {comp.cities?.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {comp.cities.filter(c => c.event_date).length > 0
                                                    ? `Events: ${comp.cities.filter(c => c.event_date).slice(0, 2).map(c => new Date(c.event_date).toLocaleDateString()).join(', ')}${comp.cities.filter(c => c.event_date).length > 2 ? '...' : ''}`
                                                    : 'Dates TBA'
                                                }
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => navigate(`/competitions/${comp.id}`)}
                                        className="text-white hover:text-white/80 text-xs sm:text-sm mt-2 sm:mt-3 inline-flex items-center gap-1">
                                        View Details
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex flex-col gap-2 sm:gap-3 w-full md:min-w-[200px] md:w-auto">
                                    {comp.registration_open && !registeredComps.has(comp.id) ? (
                                        <>
                                            <select
                                                value={selectedCity[comp.id] || ''}
                                                onChange={(e) => setSelectedCity({ ...selectedCity, [comp.id]: parseInt(e.target.value) })}
                                                className="text-xs sm:text-sm px-3 sm:px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none">
                                                <option value="">Select city...</option>
                                                {comp.cities?.map((city) => (
                                                    <option key={city.city_id} value={city.city_id}>
                                                        {city.city_name}
                                                        {city.event_date && ` (${new Date(city.event_date).toLocaleDateString()})`}
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                onClick={() => handleRegister(comp.id)}
                                                disabled={registering === comp.id}
                                                className="text-xs sm:text-sm flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white text-black font-bold uppercase tracking-wider hover:bg-white/90 transition-all">
                                                {registering === comp.id ? (
                                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                ) : (
                                                    'Register Now'
                                                )}
                                            </button>
                                        </>
                                    ) : registeredComps.has(comp.id) ? (
                                        <div className="text-sm text-white p-3 text-center">
                                            ✅ You're registered!
                                        </div>
                                    ) : (
                                        <div className="text-sm text-white/60 p-3 text-center">
                                            {comp.status === 'COMPLETED' ? 'Competition ended' : 'Registration closed'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>
            </div>
        </>
    );
};

export default Competitions;

