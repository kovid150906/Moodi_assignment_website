import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminsAPI } from '../api';

const Admins = () => {
    const { isAdmin, admin } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ full_name: '', email: '', password: '', role: 'COORDINATOR' });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
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
        loadAdmins();
    }, []);

    const loadAdmins = async () => {
        try {
            const response = await adminsAPI.getAll();
            setAdmins(response.data.data);
        } catch (error) {
            console.error('Failed to load admins:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage({ type: '', text: '' });

        try {
            await adminsAPI.create(formData);
            setShowModal(false);
            setFormData({ full_name: '', email: '', password: '', role: 'COORDINATOR' });
            loadAdmins();
        } catch (error) {
            const data = error.response?.data;
            let errorText = data?.message || 'Failed to create admin';
            
            // If there are detailed validation errors, show them
            if (data?.errors && Array.isArray(data.errors)) {
                errorText = data.errors.map(e => e.message).join('. ');
            }
            
            setMessage({ type: 'error', text: errorText });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuspend = async (adminId) => {
        if (!confirm('Suspend this coordinator?')) return;

        try {
            await adminsAPI.suspend(adminId);
            loadAdmins();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to suspend');
        }
    };

    if (!isAdmin) {
        return (
            <div className="admin-card p-8 text-center">
                <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                <p className="text-gray-400">Only ADMINs can access this page.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn w-full max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Admins & Coordinators</h1>
                <button onClick={() => setShowModal(true)} className="btn-admin w-full sm:w-auto">
                    + Add
                </button>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
                {admins.map((a) => (
                    <div key={a.id} className="admin-card p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`badge text-xs ${a.role === 'ADMIN' ? 'badge-admin' : 'badge-info'}`}>
                                        {a.role}
                                    </span>
                                    <span className={`badge text-xs ${a.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>
                                        {a.status}
                                    </span>
                                </div>
                                <div className="font-medium text-white truncate">{a.full_name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {a.role === 'COORDINATOR' && a.status === 'ACTIVE' && a.id !== admin?.id && (
                                    <button
                                        onClick={() => handleSuspend(a.id)}
                                        className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400/30 rounded"
                                    >
                                        Suspend
                                    </button>
                                )}
                                <button
                                    onClick={() => toggleExpand(a.id)}
                                    className="text-gray-400 hover:text-white p-1"
                                >
                                    {expandedRows.has(a.id) ? '▲' : '▼'}
                                </button>
                            </div>
                        </div>
                        {expandedRows.has(a.id) && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Email:</span>
                                    <span className="text-white break-all">{a.email}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {admins.length === 0 && (
                    <div className="admin-card p-8 text-center text-gray-500">
                        No admins found
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block admin-card overflow-x-auto">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {admins.map((a) => (
                            <tr key={a.id}>
                                <td className="font-medium text-white">{a.full_name}</td>
                                <td className="text-gray-400">{a.email}</td>
                                <td>
                                    <span className={`badge ${a.role === 'ADMIN' ? 'badge-admin' : 'badge-info'}`}>
                                        {a.role}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${a.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>
                                        {a.status}
                                    </span>
                                </td>
                                <td>
                                    {a.role === 'COORDINATOR' && a.status === 'ACTIVE' && a.id !== admin?.id && (
                                        <button
                                            onClick={() => handleSuspend(a.id)}
                                            className="text-red-400 hover:text-red-300 text-sm"
                                        >
                                            Suspend
                                        </button>
                                    )}
                                    {a.role === 'ADMIN' && (
                                        <span className="text-gray-600 text-sm">Protected</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-4">Create Admin/Coordinator</h2>
                        
                        {message.text && message.type === 'error' && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                                <p className="text-sm text-red-400">{message.text}</p>
                            </div>
                        )}
                        
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="input-admin"
                                    required
                                    minLength={1}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="input-admin"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input-admin"
                                    required
                                    minLength={8}
                                />
                                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                    <p>Password must contain:</p>
                                    <ul className="list-disc list-inside pl-1">
                                        <li>At least 8 characters</li>
                                        <li>One uppercase letter (A-Z)</li>
                                        <li>One lowercase letter (a-z)</li>
                                        <li>One number (0-9)</li>
                                    </ul>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="input-admin"
                                >
                                    <option value="COORDINATOR">Coordinator</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-admin" disabled={submitting}>
                                    {submitting ? 'Creating...' : 'Create'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admins;
