import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Orb from '../components/ui/Orb';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isFormActive, setIsFormActive] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black relative overflow-hidden">
            {/* Orb Background */}
            <div className="fixed inset-0 flex items-center justify-center">
                <div style={{ width: '100%', height: '100vh', position: 'absolute' }}>
                    <Orb
                        hoverIntensity={2}
                        rotateOnHover
                        hue={0}
                        forceHoverState={isFormActive}
                        backgroundColor="#000000"
                    />
                </div>
            </div>

            {/* Login Form */}
            <div className="min-h-screen flex items-center justify-center p-4 relative z-10" style={{ pointerEvents: 'none' }} onClick={(e) => e.stopPropagation()}>
                <div className="w-full max-w-md" style={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <div className="text-center mb-8">
                        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight drop-shadow-lg">
                            MOOD INDIGO
                        </h1>
                        <p className="text-white/80 text-sm uppercase tracking-widest font-medium">
                            Sign in to continue
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6" onClick={(e) => e.stopPropagation()}>
                        {error && (
                            <div className="bg-red-500/20 border-2 border-red-500/40 text-red-200 p-3 rounded-lg text-sm backdrop-blur-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-white mb-2 uppercase tracking-wider">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onFocus={() => setIsFormActive(true)}
                                onBlur={() => setIsFormActive(false)}
                                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all backdrop-blur-sm"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-white mb-2 uppercase tracking-wider">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => setIsFormActive(true)}
                                onBlur={() => setIsFormActive(false)}
                                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all backdrop-blur-sm"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-white/15 hover:bg-white/25 border-2 border-white/30 rounded-lg text-white font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 backdrop-blur-sm shadow-lg"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <p className="text-center mt-6 text-white/70 text-sm font-medium">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-white hover:text-white/90 transition-colors underline font-bold">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
