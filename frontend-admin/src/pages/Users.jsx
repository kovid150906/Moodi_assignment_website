import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../api';

const Users = () => {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ full_name: '', mi_id: '', email: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [search, setSearch] = useState('');
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
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await usersAPI.getAll({ search });
            setUsers(response.data.data);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage({ type: '', text: '' });

        try {
            await usersAPI.create(formData);
            setMessage({ type: 'success', text: 'User created successfully' });
            setFormData({ full_name: '', mi_id: '', email: '', password: '' });
            setShowModal(false);
            loadUsers();
        } catch (error) {
            const data = error.response?.data;
            let errorText = data?.message || 'Failed to create user';
            
            // If there are detailed validation errors, show them
            if (data?.errors && Array.isArray(data.errors)) {
                errorText = data.errors.map(e => e.message).join('. ');
            }
            
            setMessage({ type: 'error', text: errorText });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuspend = async (userId) => {
        if (!confirm('Are you sure you want to suspend this user?')) return;

        try {
            await usersAPI.suspend(userId);
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to suspend user');
        }
    };

    const handleActivate = async (userId) => {
        try {
            await usersAPI.activate(userId);
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to activate user');
        }
    };

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
                <h1 className="text-xl sm:text-2xl font-bold text-white">Users</h1>
                {isAdmin && (
                    <button onClick={() => setShowModal(true)} className="btn-admin">
                        + Add User
                    </button>
                )}
            </div>

            {message.text && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyUp={(e) => e.key === 'Enter' && loadUsers()}
                    className="input-admin w-full sm:max-w-md"
                />
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
                {users.map((user) => (
                    <div key={user.id} className="admin-card p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-blue-400 text-sm">{user.mi_id || '-'}</span>
                                    <span className={`badge text-xs ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>
                                        {user.status}
                                    </span>
                                </div>
                                <div className="font-medium text-white truncate">{user.full_name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    user.status === 'ACTIVE' ? (
                                        <button
                                            onClick={() => handleSuspend(user.id)}
                                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400/30 rounded"
                                        >
                                            Suspend
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(user.id)}
                                            className="text-emerald-400 hover:text-emerald-300 text-xs px-2 py-1 border border-emerald-400/30 rounded"
                                        >
                                            Activate
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => toggleExpand(user.id)}
                                    className="text-gray-400 hover:text-white p-1"
                                >
                                    {expandedRows.has(user.id) ? '▲' : '▼'}
                                </button>
                            </div>
                        </div>
                        {expandedRows.has(user.id) && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Email:</span>
                                    <span className="text-white">{user.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Joined:</span>
                                    <span className="text-white">{new Date(user.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {users.length === 0 && (
                    <div className="admin-card p-8 text-center text-gray-500">
                        No users found
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block admin-card overflow-x-auto">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>MI ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Joined</th>
                            {isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="font-medium text-blue-400">{user.mi_id || '-'}</td>
                                <td className="font-medium text-white">{user.full_name}</td>
                                <td className="text-gray-400">{user.email}</td>
                                <td>
                                    <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="text-gray-400">{new Date(user.created_at).toLocaleDateString()}</td>
                                {isAdmin && (
                                    <td>
                                        <div className="flex gap-2">
                                            {user.status === 'ACTIVE' ? (
                                                <button
                                                    onClick={() => handleSuspend(user.id)}
                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                >
                                                    Suspend
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleActivate(user.id)}
                                                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                                                >
                                                    Activate
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5} className="text-center text-gray-500 py-8">
                                    No users found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-semibold text-white mb-4">Create User</h2>
                        
                        {message.text && message.type === 'error' && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                                <p className="text-sm text-red-400">{message.text}</p>
                            </div>
                        )}
                        
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">MI ID <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={formData.mi_id}
                                    onChange={(e) => setFormData({ ...formData, mi_id: e.target.value })}
                                    className="input-admin"
                                    placeholder="e.g., MI000001"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Must be unique for each user</p>
                            </div>
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
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-admin" disabled={submitting}>
                                    {submitting ? 'Creating...' : 'Create User'}
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

export default Users;
