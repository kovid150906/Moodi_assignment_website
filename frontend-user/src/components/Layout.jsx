import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
        { path: '/competitions', label: 'Competitions', icon: '🏆' },
        { path: '/certificates', label: 'Certificates', icon: '📜' },
        { path: '/leaderboard', label: 'Leaderboard', icon: '🥇' },
        { path: '/profile', label: 'Profile', icon: '👤' },
    ];

    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="min-h-screen bg-black">
            {/* Desktop Navbar */}
            <nav className="px-6 py-2 flex items-center justify-between backdrop-blur-sm fixed top-0 left-0 right-0 z-30">
                <Link to="/dashboard" className="flex items-center gap-3">
                    <img src="/moodi-logo.png" alt="Mood Indigo" className="h-16 w-16 md:h-20 md:w-20 object-contain" />
                    <span className="text-xl md:text-2xl font-bold text-white tracking-wider hidden lg:block">MOOD INDIGO</span>
                </Link>

                <div className="hidden lg:flex items-center gap-4 xl:gap-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`text-sm uppercase tracking-wider transition-all duration-200 ${location.pathname === item.path
                                ? 'text-white font-bold'
                                : 'text-white/50 hover:text-white hover:scale-105'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                <div className="hidden lg:flex items-center gap-2 xl:gap-3">
                    <Link to="/profile" className="text-sm text-white/50 hover:text-white transition-colors truncate max-w-[100px] xl:max-w-none">
                        {user?.full_name}
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="px-3 py-2 xl:px-4 text-sm text-white/50 hover:text-white transition-colors uppercase tracking-wider whitespace-nowrap"
                    >
                        Logout
                    </button>
                </div>

                {/* Mobile & iPad Hamburger */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="lg:hidden text-white p-2"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </nav>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/80 z-40"
                    onClick={closeSidebar}
                />
            )}

            {/* Mobile Sidebar */}
            <div
                className={`lg:hidden fixed top-0 left-0 h-full w-80 bg-black z-50 transform transition-transform duration-300 ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src="/moodi-logo.png" alt="Mood Indigo" className="h-24 w-24 object-contain" />
                        <span className="text-xl font-bold text-white tracking-wider">MOOD INDIGO</span>
                    </div>
                    <button onClick={closeSidebar} className="text-white p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="text-white/50 text-sm mb-6">
                        {user?.full_name}
                    </div>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={closeSidebar}
                            className={`block py-3 px-4 text-base uppercase tracking-wider transition-colors ${
                                location.pathname === item.path
                                    ? 'text-white font-bold'
                                    : 'text-white/50 hover:text-white'
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <button
                        onClick={() => {
                            closeSidebar();
                            handleLogout();
                        }}
                        className="w-full py-3 px-4 text-base text-white/50 hover:text-white transition-colors uppercase tracking-wider text-left"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="pt-24 md:pt-28 md:pb-8">
                {children}
            </main>
        </div>
    );
};

export default Layout;
