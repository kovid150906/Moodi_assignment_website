import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedAdmin = localStorage.getItem('admin');
        const accessToken = localStorage.getItem('adminAccessToken');

        if (storedAdmin && accessToken) {
            setAdmin(JSON.parse(storedAdmin));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const response = await authAPI.login({ email, password });
        const { admin, accessToken, refreshToken } = response.data.data;

        localStorage.setItem('admin', JSON.stringify(admin));
        localStorage.setItem('adminAccessToken', accessToken);
        localStorage.setItem('adminRefreshToken', refreshToken);

        setAdmin(admin);
        return admin;
    };

    const logout = async () => {
        localStorage.removeItem('admin');
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        setAdmin(null);
    };

    // Role check helpers
    const isAdmin = admin?.role === 'ADMIN';
    const isCoordinator = admin?.role === 'COORDINATOR';

    const value = {
        admin,
        loading,
        login,
        logout,
        isAuthenticated: !!admin,
        isAdmin,
        isCoordinator
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
