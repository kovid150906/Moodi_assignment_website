import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';

const ChangePassword = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (formData.newPassword.length < 8) {
            setMessage({ type: 'error', text: 'New password must be at least 8 characters' });
            return;
        }

        if (!/[A-Z]/.test(formData.newPassword)) {
            setMessage({ type: 'error', text: 'Password must contain at least one uppercase letter' });
            return;
        }

        if (!/[a-z]/.test(formData.newPassword)) {
            setMessage({ type: 'error', text: 'Password must contain at least one lowercase letter' });
            return;
        }

        if (!/[0-9]/.test(formData.newPassword)) {
            setMessage({ type: 'error', text: 'Password must contain at least one number' });
            return;
        }

        setLoading(true);
        try {
            await authAPI.changePassword(formData.currentPassword, formData.newPassword);
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            
            // Redirect after 2 seconds
            setTimeout(() => navigate('/dashboard'), 2000);
        } catch (error) {
            const data = error.response?.data;
            let errorText = data?.message || 'Failed to change password';
            
            // If there are detailed validation errors, show them
            if (data?.errors && Array.isArray(data.errors)) {
                errorText = data.errors.map(e => e.message).join('. ');
            }
            
            setMessage({ type: 'error', text: errorText });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fadeIn max-w-md mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-white text-sm mb-4"
            >
                ← Back
            </button>

            <div className="admin-card p-4 sm:p-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">🔐 Change Password</h1>

                {message.text && (
                    <div className={`mb-4 p-3 rounded-lg ${
                        message.type === 'success' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={formData.currentPassword}
                            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                            className="input-admin"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                            className="input-admin"
                            minLength={8}
                            required
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
                        <label className="block text-sm text-gray-400 mb-1">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="input-admin"
                            minLength={8}
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-admin"
                        >
                            {loading ? 'Changing...' : 'Change Password'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="btn-outline"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePassword;
