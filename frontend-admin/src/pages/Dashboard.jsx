import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { competitionsAPI, usersAPI } from '../api';

const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.8,
            delay: 0.1 * i,
            ease: [0.25, 0.4, 0.25, 1]
        }
    })
};

const Dashboard = () => {
    const { admin, isAdmin } = useAuth();
    const [stats, setStats] = useState({
        competitions: 0,
        users: 0,
        activeCompetitions: 0
    });
    const [recentCompetitions, setRecentCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleExpand = (id) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [compRes, usersRes] = await Promise.all([
                competitionsAPI.getAll(),
                usersAPI.getAll()
            ]);

            const competitions = compRes.data.data;
            const users = usersRes.data.data;

            setStats({
                competitions: competitions.length,
                activeCompetitions: competitions.filter(c => c.status === 'ACTIVE').length,
                users: users.length
            });

            setRecentCompetitions(competitions.slice(0, 5));
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span className="text-white/50 text-sm tracking-wider uppercase">Loading</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full overflow-x-hidden">
            <motion.div 
                className="mb-8"
                custom={0}
                initial="hidden"
                animate="visible"
                variants={fadeUpVariants}
            >
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    Welcome, {admin?.full_name}
                </h1>
                <p className="text-white/40 text-sm flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.1]">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span className="text-white/70 text-xs uppercase tracking-wider">{admin?.role}</span>
                    </span>
                </p>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 mb-8">
                <motion.div 
                    className="admin-card p-4 sm:p-6 hover-glow transition-all duration-300"
                    custom={1}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUpVariants}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-3xl sm:text-4xl font-bold text-white">{stats.competitions}</div>
                            <div className="text-xs sm:text-sm text-white/40 mt-2 uppercase tracking-wider">Competitions</div>
                        </div>
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/[0.05] rounded-xl flex items-center justify-center border border-white/[0.08]">
                            <span className="text-xl sm:text-2xl">◆</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                    className="admin-card p-4 sm:p-6 hover-glow transition-all duration-300"
                    custom={2}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUpVariants}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-3xl sm:text-4xl font-bold text-white">{stats.activeCompetitions}</div>
                            <div className="text-xs sm:text-sm text-white/40 mt-2 uppercase tracking-wider">Active</div>
                        </div>
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/[0.05] rounded-xl flex items-center justify-center border border-white/[0.08]">
                            <span className="text-xl sm:text-2xl">●</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                    className="admin-card p-4 sm:p-6 hover-glow transition-all duration-300 sm:col-span-2 md:col-span-1"
                    custom={3}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUpVariants}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-3xl sm:text-4xl font-bold text-white">{stats.users}</div>
                            <div className="text-xs sm:text-sm text-white/40 mt-2 uppercase tracking-wider">Users</div>
                        </div>
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/[0.05] rounded-xl flex items-center justify-center border border-white/[0.08]">
                            <span className="text-xl sm:text-2xl">○</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Quick Actions */}
            {isAdmin && (
                <motion.div 
                    className="admin-card p-4 sm:p-6 mb-8"
                    custom={4}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUpVariants}
                >
                    <h2 className="text-xs sm:text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">Quick Actions</h2>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                        <a href="/competitions" className="btn-admin">+ Competition</a>
                        <a href="/users" className="btn-primary">+ User</a>
                        <a href="/templates" className="btn-secondary">+ Template</a>
                    </div>
                </motion.div>
            )}

            {/* Recent Competitions */}
            <motion.div 
                className="admin-card"
                custom={5}
                initial="hidden"
                animate="visible"
                variants={fadeUpVariants}
            >
                <div className="p-4 sm:p-5 border-b border-white/[0.08]">
                    <h2 className="text-xs sm:text-sm font-medium text-white/60 uppercase tracking-wider">Recent Competitions</h2>
                </div>
                
                {/* Mobile Cards View */}
                <div className="md:hidden p-3 space-y-3">
                    {recentCompetitions.map((comp) => (
                        <div key={comp.id} className="bg-white/[0.03] rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`badge text-xs ${comp.status === 'ACTIVE' ? 'badge-success' :
                                                comp.status === 'COMPLETED' ? 'badge-info' :
                                                    comp.status === 'DRAFT' ? 'badge-warning' : 'badge-error'
                                            }`}>
                                            {comp.status}
                                        </span>
                                    </div>
                                    <div className="font-medium text-white truncate">{comp.name}</div>
                                </div>
                                <button
                                    onClick={() => toggleExpand(comp.id)}
                                    className="text-gray-400 hover:text-white p-1"
                                >
                                    {expandedRows.has(comp.id) ? '▲' : '▼'}
                                </button>
                            </div>
                            {expandedRows.has(comp.id) && (
                                <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Registration:</span>
                                        <span className={comp.registration_open ? 'text-white' : 'text-white/40'}>
                                            {comp.registration_open ? '● Open' : '○ Closed'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Participants:</span>
                                        <span className="text-white">{comp.participant_count || 0}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {recentCompetitions.length === 0 && (
                        <div className="text-center text-white/30 py-8">
                            No competitions yet
                        </div>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Registration</th>
                                <th>Participants</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentCompetitions.map((comp) => (
                                <tr key={comp.id}>
                                    <td className="font-medium text-white">{comp.name}</td>
                                    <td>
                                        <span className={`badge ${comp.status === 'ACTIVE' ? 'badge-success' :
                                                comp.status === 'COMPLETED' ? 'badge-info' :
                                                    comp.status === 'DRAFT' ? 'badge-warning' : 'badge-error'
                                            }`}>
                                            {comp.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={comp.registration_open ? 'text-white' : 'text-white/40'}>
                                            {comp.registration_open ? '● Open' : '○ Closed'}
                                        </span>
                                    </td>
                                    <td>{comp.participant_count || 0}</td>
                                </tr>
                            ))}
                            {recentCompetitions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center text-white/30 py-12">
                                        No competitions yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
