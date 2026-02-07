import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 &&
            error.response?.data?.code === 'TOKEN_EXPIRED' &&
            !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

                const { accessToken } = response.data.data;
                localStorage.setItem('accessToken', accessToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    logout: () => {
        const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
        const refreshToken = localStorage.getItem('refreshToken');
        return api.post('/auth/logout', { userId, refreshToken });
    }
};

// Profile API
export const profileAPI = {
    get: () => api.get('/profile'),
    update: (data) => api.put('/profile', data),
    getStats: () => api.get('/profile/stats'),
    changePassword: (currentPassword, newPassword) =>
        api.post('/profile/change-password', { current_password: currentPassword, new_password: newPassword }),
    getHistory: () => api.get('/profile/history')
};

// Competitions API
export const competitionsAPI = {
    getAll: (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.city_id) params.append('city_id', filters.city_id);
        return api.get(`/competitions?${params.toString()}`);
    },
    getById: (id) => api.get(`/competitions/${id}`),
    getDetails: (id) => api.get(`/competitions/${id}/details`),
    register: (id, cityId) => api.post(`/competitions/${id}/register`, { city_id: cityId }),
    getMyRegistrations: () => api.get('/competitions/my/registrations'),
    getCities: () => api.get('/competitions/cities/list')
};

// Certificates API
export const certificatesAPI = {
    getAll: () => api.get('/certificates'),
    download: (id) => api.get(`/certificates/${id}/download`, { responseType: 'blob' })
};

// Leaderboard API
export const leaderboardAPI = {
    get: () => api.get('/leaderboard'),
    byCompetition: (id) => api.get(`/leaderboard/competition/${id}`),
    byCity: (id) => api.get(`/leaderboard/city/${id}`),
    // Round-based leaderboard
    getCompetitionsWithRounds: () => api.get('/leaderboard/competitions-with-rounds'),
    getCompetitionRounds: (id) => api.get(`/leaderboard/competition/${id}/rounds`),
    getCompetitionWinners: (id) => api.get(`/leaderboard/competition/${id}/winners`),
    getRoundLeaderboard: (roundId) => api.get(`/leaderboard/round/${roundId}`),
    getMyPositions: (competitionId) => api.get(`/leaderboard/my-positions/${competitionId}`)
};

export default api;

