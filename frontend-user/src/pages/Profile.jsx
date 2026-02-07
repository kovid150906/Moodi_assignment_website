import { useState, useEffect } from 'react';
import { profileAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/ui/Loading';
import Particles from '../components/ui/Particles';
import TextRewind from '../components/ui/TextRewind';

const Profile = () => {
    const { user, setUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({ full_name: '' });
    const [saving, setSaving] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [changingPassword, setChangingPassword] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadProfile();
        loadStats();
    }, []);

    const loadProfile = async () => {
        try {
            const response = await profileAPI.get();
            setProfile(response.data.data);
            setEditData({ full_name: response.data.data.full_name });
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await profileAPI.getStats();
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const response = await profileAPI.update(editData);
            setProfile(response.data.data);
            setEditing(false);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            // Update user context
            if (setUser && user) {
                const updatedUser = { ...user, full_name: response.data.data.full_name };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }
        if (passwordData.new.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }
        setChangingPassword(true);
        setMessage({ type: '', text: '' });
        try {
            await profileAPI.changePassword(passwordData.current, passwordData.new);
            setShowPasswordModal(false);
            setPasswordData({ current: '', new: '', confirm: '' });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to change password' });
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return <Loading />;
    }

    return (
        <>
            {/* Particles Background */}
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

            <div className="relative z-10 px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 text-white animate-fadeIn max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 uppercase tracking-widest">MY PROFILE</h1>
                <p className="text-sm sm:text-base text-white/60">Manage your account details</p>
            </div>

            {message.text && (
                <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg text-sm sm:text-base ${message.type === 'success' ? 'bg-white/10 border border-white/30 text-white' : 'bg-white/5 border border-white/20 text-white/80'}`}>
                    {message.text}
                </div>
            )}

            {/* Profile Card */}
            <div className="p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 rounded-lg hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full sm:w-auto">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center text-2xl sm:text-3xl font-bold text-black flex-shrink-0">
                            {profile?.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="text-center sm:text-left">
                            {!editing ? (
                                <>
                                    <h2 className="text-xl sm:text-2xl font-bold text-white">{profile?.full_name}</h2>
                                    <p className="text-white/80 font-medium text-sm sm:text-base">MI ID: {profile?.mi_id}</p>
                                    <p className="text-white/60 text-sm sm:text-base">{profile?.email}</p>
                                    <p className="text-xs sm:text-sm text-white/40 mt-1">
                                        Member since {new Date(profile?.created_at).toLocaleDateString()}
                                    </p>
                                </>
                            ) : (
                                <form onSubmit={handleSaveProfile} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-white/60 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={editData.full_name}
                                            onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                                            className="w-full sm:w-64 px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none"
                                            required
                                            minLength={2}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" disabled={saving} className="px-4 py-2 bg-white text-black font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-white/90 transition-all disabled:opacity-50">
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 bg-white/10 text-white font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-white/20 transition-all">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                    {!editing && (
                        <button onClick={() => setEditing(true)} className="w-full sm:w-auto px-4 py-2 bg-white/10 text-white font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-white/20 transition-all">
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* Stats Grid */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-6 border-t border-white/20">
                        <div className="text-center">
                            <div className="text-xl sm:text-2xl font-bold text-white">{stats.total_participations || 0}</div>
                            <div className="text-xs sm:text-sm text-white/60">Participations</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl sm:text-2xl font-bold text-white">{stats.wins || 0}</div>
                            <div className="text-xs sm:text-sm text-white/60">Wins</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl sm:text-2xl font-bold text-white">{stats.first_places || 0}</div>
                            <div className="text-xs sm:text-sm text-white/60">1st Places</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl sm:text-2xl font-bold text-white">{stats.certificates_earned || 0}</div>
                            <div className="text-xs sm:text-sm text-white/60">Certificates</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Section */}
            <div className="p-4 sm:p-6 rounded-lg hover:shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 text-white">Security</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4 border-t border-white/20">
                    <div>
                        <div className="font-medium text-white text-sm sm:text-base">Password</div>
                        <div className="text-xs sm:text-sm text-white/60">Change your account password</div>
                    </div>
                    <button onClick={() => setShowPasswordModal(true)} className="w-full sm:w-auto px-4 py-2 bg-white/10 text-white font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-white/20 transition-all">
                        Change Password
                    </button>
                </div>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-black border border-white/20 p-4 sm:p-6 w-full max-w-md rounded-lg">
                        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-white">Change Password</h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordData.current}
                                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                    className="w-full px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.new}
                                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                    className="w-full px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirm}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                    className="w-full px-4 py-2 bg-black text-white border border-white/20 focus:border-white/40 focus:outline-none"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={changingPassword} className="flex-1 px-4 py-2 bg-white text-black font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-white/90 transition-all disabled:opacity-50">
                                    {changingPassword ? 'Changing...' : 'Change Password'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setPasswordData({ current: '', new: '', confirm: '' });
                                    }}
                                    className="flex-1 px-4 py-2 bg-white/10 text-white font-bold uppercase tracking-wider text-xs sm:text-sm hover:bg-white/20 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </>
    );
};

export default Profile;
