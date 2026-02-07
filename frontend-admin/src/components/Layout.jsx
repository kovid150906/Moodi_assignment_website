import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { ElegantShape } from './ui/shape-landing-hero';

const Layout = ({ children }) => {
    const { admin, logout, isAdmin } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });

    // Save collapse preference
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Close sidebar on window resize if going to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 1024) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: '◇' },
        { path: '/competitions', label: 'Competitions', icon: '◆' },
        { path: '/users', label: 'Users', icon: '○' },
        { path: '/admins', label: 'Admins', icon: '●', adminOnly: true },
        { path: '/templates', label: 'Templates', icon: '□' },
        { path: '/certificates', label: 'Certificates', icon: '■' },
    ];

    const filteredNav = navItems.filter(item => !item.adminOnly || isAdmin);

    return (
        <div className="min-h-screen flex bg-[#030303]">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`mobile-menu-btn ${sidebarOpen ? 'is-open' : ''}`}
                aria-label="Toggle menu"
            >
                {sidebarOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12h18M3 6h18M3 18h18" />
                    </svg>
                )}
            </button>

            {/* Mobile Overlay */}
            <div 
                className={`sidebar-overlay ${sidebarOpen ? 'is-visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar flex flex-col ${sidebarOpen ? 'is-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
                {/* Collapse Toggle Button (Desktop) */}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="sidebar-collapse-btn"
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                {/* Background geometric shapes */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                    <ElegantShape
                        delay={0.3}
                        width={100}
                        height={80}
                        rotate={12}
                        gradient="from-indigo-500/[0.15]"
                        className="left-[-20px] top-[20%]"
                    />
                    <ElegantShape
                        delay={0.5}
                        width={80}
                        height={60}
                        rotate={-15}
                        gradient="from-rose-500/[0.15]"
                        className="right-[-10px] top-[60%]"
                    />
                </div>

                <div className={`p-5 border-b border-white/[0.08] relative z-10 ${sidebarCollapsed ? 'px-3 py-4' : ''}`}>
                    <h1 className={`font-bold text-white tracking-wider transition-all duration-300 ${sidebarCollapsed ? 'text-center text-xl' : 'text-lg'}`}>
                        {sidebarCollapsed ? 'MI' : 'MOOD INDIGO'}
                    </h1>
                    {!sidebarCollapsed && (
                        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1">Admin Portal</p>
                    )}
                </div>

                <nav className={`flex-1 space-y-1 relative z-10 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
                    {filteredNav.map((item, index) => (
                        <motion.div
                            key={item.path}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Link
                                to={item.path}
                                title={sidebarCollapsed ? item.label : ''}
                                className={`flex items-center rounded-lg transition-all duration-300 ${
                                    sidebarCollapsed 
                                        ? 'justify-center px-2 py-3' 
                                        : 'gap-3 px-4 py-3'
                                } ${location.pathname === item.path
                                        ? 'bg-white/[0.1] text-white border border-white/[0.15]'
                                        : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                                    }`}
                            >
                                <span className={sidebarCollapsed ? 'text-lg' : 'text-sm'}>{item.icon}</span>
                                {!sidebarCollapsed && (
                                    <span className="text-sm font-medium tracking-wide">{item.label}</span>
                                )}
                            </Link>
                        </motion.div>
                    ))}
                </nav>

                <div className={`border-t border-white/[0.08] relative z-10 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
                    <div className={`flex items-center mb-4 ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <div 
                            className={`bg-white/[0.1] rounded-full flex items-center justify-center text-white font-semibold border border-white/[0.15] ${
                                sidebarCollapsed ? 'w-10 h-10 text-base' : 'w-9 h-9 text-sm'
                            }`}
                            title={sidebarCollapsed ? admin?.full_name : ''}
                        >
                            {admin?.full_name?.charAt(0)}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white font-medium truncate">{admin?.full_name}</div>
                                <div className="text-[10px] text-white/40 uppercase tracking-wider">
                                    {admin?.role}
                                </div>
                            </div>
                        )}
                    </div>
                    <Link
                        to="/change-password"
                        title={sidebarCollapsed ? 'Change Password' : ''}
                        className={`w-full text-white/50 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all duration-300 flex items-center justify-center mb-2 ${
                            sidebarCollapsed ? 'py-3 text-lg' : 'py-2.5 text-sm gap-2'
                        }`}
                    >
                        {sidebarCollapsed ? '○' : '○ Change Password'}
                    </Link>
                    <button
                        onClick={handleLogout}
                        title={sidebarCollapsed ? 'Sign Out' : ''}
                        className={`w-full text-white/50 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all duration-300 ${
                            sidebarCollapsed ? 'py-3 text-lg' : 'py-2.5 text-sm'
                        }`}
                    >
                        {sidebarCollapsed ? '↪' : 'Sign Out'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`main-content px-3 py-4 sm:p-6 lg:p-8 relative w-full ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                {/* Background geometric accents */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                    <ElegantShape
                        delay={0}
                        width={400}
                        height={100}
                        rotate={12}
                        gradient="from-indigo-500/[0.05]"
                        className="top-[-50px] right-[-100px]"
                    />
                    <ElegantShape
                        delay={0.4}
                        width={300}
                        height={80}
                        rotate={-12}
                        gradient="from-rose-500/[0.05]"
                        className="bottom-[-20px] left-[20%]"
                    />
                </div>
                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
