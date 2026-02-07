import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileAPI, competitionsAPI } from '../api';
import { GooeyText } from '../components/ui/gooey-text-morphing';
import Particles from '../components/ui/Particles';
import Loading from '../components/ui/Loading';
import TextRewind from '../components/ui/TextRewind';

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAnimation, setShowAnimation] = useState(true);

    useEffect(() => {
        loadData();
        
        // Hide animation after 4 seconds
        const timer = setTimeout(() => {
            setShowAnimation(false);
        }, 4000);
        
        return () => clearTimeout(timer);
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, regsRes] = await Promise.all([
                profileAPI.getStats(),
                competitionsAPI.getMyRegistrations()
            ]);
            setStats(statsRes.data.data);
            setRegistrations(regsRes.data.data);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Full screen animation
    if (showAnimation) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
                <div className="h-[120px] flex items-center justify-center mb-8">
                    <GooeyText
                        texts={["MOOD INDIGO", "मूड इंडिगो"]}
                        morphTime={1.2}
                        cooldownTime={0.8}
                        textClassName="text-5xl md:text-6xl font-bold tracking-wider"
                        className="font-mono"
                    />
                </div>
                <button 
                    onClick={() => setShowAnimation(false)}
                    className="mt-8 text-neutral-500 hover:text-white text-sm transition-colors"
                >
                    Skip →
                </button>
            </div>
        );
    }

    if (loading) {
        return <Loading />;
    }

    return (
        <>
            {/* Particles Background - positioned above content */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <Particles
                    particleColors={["#ffffff"]}
                    particleCount={200}
                    particleSpread={10}
                    speed={0.1}
                    particleBaseSize={100}
                    moveParticlesOnHover={false}
                    alphaParticles={true}
                    disableRotation={false}
                    pixelRatio={1}
                />
            </div>

            {/* TextRewind Background Text */}
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, pointerEvents: 'none', opacity: 0.2 }}>
                <TextRewind text="MOOD INDIGO" />
            </div>

            <div className="relative z-10 px-6 sm:px-8 pb-6 sm:pb-8 text-white">
                <div className="max-w-7xl mx-auto">
                {/* Welcome Header */}
                <div className="mb-8 sm:mb-10 pb-6 sm:pb-8">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 tracking-tight">
                        Welcome back, {user?.full_name}
                    </h1>
                    <p className="text-white/60 text-sm sm:text-base">MI ID: <span className="text-white font-mono tracking-wider">{user?.mi_id}</span></p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
                    <div className="text-center">
                        <div className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-light mb-2">{stats?.total_participations || 0}</div>
                        <div className="text-xs uppercase tracking-widest text-white/50">Competitions</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-light mb-2">{stats?.wins || 0}</div>
                        <div className="text-xs uppercase tracking-widest text-white/50">Wins</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-light mb-2">{stats?.first_places || 0}</div>
                        <div className="text-xs uppercase tracking-widest text-white/50">1st Places</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-light mb-2">{stats?.certificates_earned || 0}</div>
                        <div className="text-xs uppercase tracking-widest text-white/50">Certificates</div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-12">
                    <Link 
                        to="/competitions" 
                        className="px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-black text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-white/90 hover:scale-105 transition-all text-center"
                    >
                        Browse Competitions
                    </Link>
                    <Link 
                        to="/certificates" 
                        className="px-6 sm:px-8 py-3 sm:py-3.5 border border-white text-white text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-white hover:text-black hover:scale-105 transition-all text-center"
                    >
                        View Certificates
                    </Link>
                </div>

                {/* Recent Registrations */}
                <div className="pt-6 sm:pt-8">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6 sm:mb-8 uppercase tracking-widest">My Registrations</h2>

                    {registrations.length === 0 ? (
                        <div className="text-center py-12 sm:py-20 text-white/50">
                            <p className="mb-4 sm:mb-6 text-lg sm:text-xl">You haven't registered for any competitions yet.</p>
                            <Link 
                                to="/competitions" 
                                className="text-white hover:underline text-lg sm:text-xl font-medium inline-flex items-center gap-2"
                            >
                                Browse available competitions →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {registrations.slice(0, 5).map((reg) => (
                                <div
                                    key={reg.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between py-8 sm:py-9 px-4 -mx-4 rounded-lg transition-all duration-300 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)] cursor-pointer gap-3"
                                >
                                    <div className="flex-1">
                                        <div className="font-bold text-base sm:text-lg md:text-xl mb-1">{reg.competition_name}</div>
                                        <div className="text-xs sm:text-sm text-white/60 mb-1">
                                            {reg.city_name} • {new Date(reg.registered_at).toLocaleDateString()}
                                        </div>
                                        {reg.latest_round && (
                                            <div className="text-xs text-white/50 font-mono tracking-wide">
                                                {reg.latest_round}
                                                {reg.latest_rank && ` • Rank #${reg.latest_rank}`}
                                                {reg.latest_score && ` • Score: ${reg.latest_score}`}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-4">
                                        {reg.is_winner && (
                                            <span className="px-3 sm:px-4 py-1 sm:py-2 bg-white text-black text-xs sm:text-sm font-black">
                                                #{reg.winner_position}
                                            </span>
                                        )}
                                        <span className={`px-2 sm:px-4 py-1 sm:py-2 text-xs font-bold uppercase tracking-wider ${
                                            reg.competition_status === 'ACTIVE' ? 'text-white' :
                                            reg.competition_status === 'COMPLETED' ? 'text-white/50' :
                                            'text-white/60'
                                        }`}>
                                            {reg.competition_status === 'ACTIVE' ? 'Ongoing' : reg.competition_status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </div>
            </div>
        </>
    );
};

export default Dashboard;
