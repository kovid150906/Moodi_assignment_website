import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminAccessToken");
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

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === "TOKEN_EXPIRED" &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("adminRefreshToken");
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem("adminAccessToken", accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("adminAccessToken");
        localStorage.removeItem("adminRefreshToken");
        localStorage.removeItem("admin");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  changePassword: (currentPassword, newPassword) =>
    api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get("/users", { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post("/users", data),
  bulkCreate: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/users/bulk", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  suspend: (id) => api.patch(`/users/${id}/suspend`),
  activate: (id) => api.patch(`/users/${id}/activate`),
  resetPassword: (id, password) =>
    api.post(`/users/${id}/reset-password`, { new_password: password }),
};

// Admins API
export const adminsAPI = {
  getAll: () => api.get("/admins"),
  create: (data) => api.post("/admins", data),
  suspend: (id) => api.patch(`/admins/${id}/suspend`),
  getAuditLogs: (params) => api.get("/admins/audit-logs", { params }),
};

// Competitions API
export const competitionsAPI = {
  getAll: (params) => api.get("/competitions", { params }),
  getById: (id) => api.get(`/competitions/${id}`),
  getDashboard: (id) => api.get(`/competitions/${id}/dashboard`),
  getCities: () => api.get("/competitions/cities"),
  createCity: (name) => api.post("/competitions/cities", { name }),
  getParticipants: (id) => api.get(`/competitions/${id}/participants`),
  create: (data) => api.post("/competitions", data),
  update: (id, data) => api.patch(`/competitions/${id}`, data),
  updateStatus: (id, status) =>
    api.patch(`/competitions/${id}/status`, { status }),
  toggleRegistration: (id, registration_open) =>
    api.patch(`/competitions/${id}/registration`, { registration_open }),
  delete: (id) => api.delete(`/competitions/${id}`),
  addParticipant: (id, data) =>
    api.post(`/competitions/${id}/participants`, data),
  addCity: (id, data) => api.post(`/competitions/${id}/cities`, data),
};

// Results API
export const resultsAPI = {
  getByCompetition: (id) => api.get(`/results/competition/${id}`),
  assign: (data) => api.post("/results", data),
  bulkAssign: (results) => api.post("/results/bulk", { results }),
  lock: (id) => api.patch(`/results/${id}/lock`),
  unlock: (id) => api.patch(`/results/${id}/unlock`),
};

// Templates API
export const templatesAPI = {
  getAll: (params) => api.get("/certificates/templates", { params }),
  getById: (id) => api.get(`/certificates/templates/${id}`),
  create: (file, data) => {
    const formData = new FormData();
    formData.append("file", file);
    Object.keys(data).forEach((key) => formData.append(key, data[key]));
    return api.post("/certificates/templates", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  update: (id, data) => api.put(`/certificates/templates/${id}`, data),
  linkToCompetition: (id, competitionId) =>
    api.put(`/certificates/templates/${id}`, { competition_id: competitionId }),
  delete: (id) => api.delete(`/certificates/templates/${id}`),
  archive: (id) => api.post(`/certificates/templates/${id}/archive`),
  addField: (id, data) =>
    api.post(`/certificates/templates/${id}/fields`, data),
  updateField: (fieldId, data) =>
    api.put(`/certificates/templates/fields/${fieldId}`, data),
  deleteField: (fieldId) =>
    api.delete(`/certificates/templates/fields/${fieldId}`),
  bulkUpdateFields: (id, fields) =>
    api.put(`/certificates/templates/${id}/fields/bulk`, { fields }),
  getPreviewImage: (id) =>
    api.get(`/certificates/templates/${id}/preview-image`),
  parseSVG: (id) => api.post(`/certificates/templates/${id}/parse-svg`),
  previewPlaceholders: (id, fields) =>
    api.post(
      `/certificates/templates/${id}/preview-placeholders`,
      { fields },
      { responseType: "blob" }
    ),
  getPDF: (id) =>
    api.get(`/certificates/templates/${id}/pdf`, { responseType: "blob" }),
};

// Certificates API
export const certificatesAPI = {
  getAll: (params) => api.get("/certificates", { params }),
  getStats: () => api.get("/certificates/stats"),
  getCountsByCompetition: (competitionId) => 
    api.get(`/certificates/counts/competition/${competitionId}`),
  generate: (data) => api.post("/certificates/generate", data),
  generateForCompetition: (data) =>
    api.post("/certificates/generate/competition", data),
  generateForRound: (data) =>
    api.post("/certificates/generate/round", data),
  generateForWinners: (data) =>
    api.post("/certificates/generate/winners", data),
  release: (id) => api.post(`/certificates/${id}/release`),
  bulkRelease: (ids) =>
    api.post("/certificates/release/bulk", { certificate_ids: ids }),
  releaseByRound: (roundId) =>
    api.post(`/certificates/release/round/${roundId}`),
  releaseForWinners: (roundId, templateId) =>
    api.post(`/certificates/release/winners/${roundId}`, { template_id: templateId }),
  withdrawForWinners: (roundId, templateId, reason) =>
    api.post(`/certificates/withdraw/winners/${roundId}`, { template_id: templateId, reason }),
  revoke: (id, reason) => api.post(`/certificates/${id}/revoke`, { reason }),
  revokeByCompetition: (competitionId, reason) =>
    api.post(`/certificates/revoke/competition/${competitionId}`, { reason }),
  revokeByRound: (roundId, reason) =>
    api.post(`/certificates/revoke/round/${roundId}`, { reason }),
  delete: (id) => api.delete(`/certificates/${id}`),
  download: (id) =>
    api.get(`/certificates/${id}/download`, { responseType: "blob" }),
  preview: (templateId, participationId = null, sampleData = null) =>
    api.post("/certificates/preview", {
      template_id: templateId,
      participation_id: participationId,
      sample_data: sampleData,
    }),
};

// Rounds API
export const roundsAPI = {
  create: (data) => api.post("/rounds", data),
  getByCompetition: (competitionId) =>
    api.get(`/rounds/competition/${competitionId}`),
  getDetails: (id) => api.get(`/rounds/${id}`),
  update: (id, data) => api.patch(`/rounds/${id}`, data),
  delete: (id) => api.delete(`/rounds/${id}`),
  archive: (id) => api.patch(`/rounds/${id}/archive`),
  unarchive: (id) => api.patch(`/rounds/${id}/unarchive`),
  uploadScores: (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/rounds/${id}/upload-scores`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  promote: (id, count) => api.post(`/rounds/${id}/promote`, { count }),
  addParticipant: (id, participationId) =>
    api.post(`/rounds/${id}/add-participant`, {
      participation_id: participationId,
    }),
  removeParticipant: (id, participationId) =>
    api.delete(`/rounds/${id}/participants/${participationId}`),
  getEligibleParticipants: (id) =>
    api.get(`/rounds/${id}/eligible-participants`),
  updateScore: (roundParticipationId, score, notes) =>
    api.patch(`/rounds/scores/${roundParticipationId}`, { score, notes }),
  clearScores: (id) => api.delete(`/rounds/${id}/scores`),
  selectWinners: (id, winners) =>
    api.post(`/rounds/${id}/select-winners`, { winners }),
  importWinners: (id) => api.post(`/rounds/${id}/import-winners`),
  getAvailableWinners: (id) => api.get(`/rounds/${id}/available-winners`),
  importSelectedWinners: (id, citySelections) =>
    api.post(`/rounds/${id}/import-selected-winners`, { citySelections }),
  getLeaderboard: (id) => api.get(`/rounds/${id}/leaderboard`),
  getCityStatus: (competitionId, cityId) =>
    api.get(`/rounds/competition/${competitionId}/city/${cityId}/status`),
  markCityFinished: (competitionId, cityId) =>
    api.post(`/rounds/competition/${competitionId}/city/${cityId}/finish`),
  reopenCity: (competitionId, cityId) =>
    api.post(`/rounds/competition/${competitionId}/city/${cityId}/reopen`),
};

export default api;
