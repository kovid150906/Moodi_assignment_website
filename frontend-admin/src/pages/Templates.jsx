import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const Templates = () => {
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filter, setFilter] = useState({ status: '', competition_id: '' });
  const [uploadData, setUploadData] = useState({
    name: '',
    description: '',
    file: null,
    competition_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadCompetitions();
  }, [filter]);

  const loadTemplates = async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.competition_id) params.competition_id = filter.competition_id;

      const response = await api.get('/certificates/templates', { params });
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitions = async () => {
    try {
      // Get ALL competitions without status filter to show drafts and closed ones too
      const response = await api.get('/competitions');
      setCompetitions(response.data.competitions || response.data.data || []);
    } catch (error) {
      console.error('Failed to load competitions:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadData(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!uploadData.name || !uploadData.file) {
      alert('Please provide template name and file');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('template_file', uploadData.file);
      formData.append('name', uploadData.name);
      if (uploadData.description) formData.append('description', uploadData.description);
      if (uploadData.competition_id) formData.append('competition_id', uploadData.competition_id);

      await api.post('/certificates/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Template uploaded successfully!');
      setShowUploadModal(false);
      setUploadData({
        name: '',
        description: '',
        file: null,
        competition_id: ''
      });
      loadTemplates();
    } catch (error) {
      alert(error.response?.data?.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Are you sure you want to archive this template?')) return;

    try {
      await api.post(`/certificates/templates/${id}/archive`);
      alert('Template archived successfully');
      loadTemplates();
    } catch (error) {
      alert(error.response?.data?.message || 'Archive failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;

    try {
      await api.delete(`/certificates/templates/${id}`);
      alert('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      alert(error.response?.data?.message || 'Delete failed');
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-card p-8 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400">Only admins can manage certificate templates.</p>
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
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Certificate Templates</h1>
          <p className="text-gray-400 text-sm mt-1">Manage certificate templates and configure dynamic fields</p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="btn-admin w-full sm:w-auto">
          + Upload New Template
        </button>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="input-admin"
              style={{ colorScheme: 'dark' }}
            >
              <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>All Status</option>
              <option value="ACTIVE" style={{ background: '#1a1a1a', color: '#fff' }}>Active</option>
              <option value="ARCHIVED" style={{ background: '#1a1a1a', color: '#fff' }}>Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Competition</label>
            <select
              value={filter.competition_id}
              onChange={(e) => setFilter(prev => ({ ...prev, competition_id: e.target.value }))}
              className="input-admin"
              style={{ colorScheme: 'dark' }}
            >
              <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>All Competitions</option>
              {competitions.map(comp => (
                <option key={comp.id} value={comp.id} style={{ background: '#1a1a1a', color: '#fff' }}>{comp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {templates.map((template) => (
          <div key={template.id} className="admin-card p-4 sm:p-5 hover:border-blue-500/30 transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-white text-sm sm:text-base break-words">{template.name}</h3>
                {template.competition_name && (
                  <p className="text-xs text-gray-400 mt-1 break-words">For: {template.competition_name}</p>
                )}
              </div>
              <span className={`badge flex-shrink-0 ${template.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                {template.status}
              </span>
            </div>

            {template.description && (
              <p className="text-sm text-gray-400 mb-3">{template.description}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
              <span>{template.file_type}</span>
              <span>•</span>
              <span>{template.orientation}</span>
              <span>•</span>
              <span>{template.field_count} fields</span>
            </div>

            <div className="text-xs text-gray-500 mb-4">
              <div>Used in {template.usage_count} certificates</div>
              <div>Created: {new Date(template.created_at).toLocaleDateString()}</div>
            </div>

            <div className="flex gap-2">
              <Link
                to={`/templates/${template.id}`}
                className="flex-1 btn-admin text-center text-sm py-2"
              >
                Configure
              </Link>
              {template.status === 'ACTIVE' ? (
                <button
                  onClick={() => handleArchive(template.id)}
                  className="btn-secondary text-sm py-2 px-3"
                >
                  Archive
                </button>
              ) : (
                <button
                  onClick={() => handleDelete(template.id)}
                  className="btn-danger text-sm py-2 px-3"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="admin-card p-12 text-center">
          <p className="text-gray-400 mb-4">No templates found</p>
          <button onClick={() => setShowUploadModal(true)} className="btn-admin">
            Upload Your First Template
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="admin-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Upload Certificate Template</h2>

            <form onSubmit={handleUpload}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={uploadData.name}
                    onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-admin"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                    className="input-admin"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Template File (PDF, PNG, JPG) *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="input-admin"
                    required
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-400">
                    📄 Page dimensions and orientation will be automatically detected from your PDF file.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Link to Competition (Optional)
                  </label>
                  <select
                    value={uploadData.competition_id}
                    onChange={(e) => setUploadData(prev => ({ ...prev, competition_id: e.target.value }))}
                    className="input-admin"
                  >
                    <option value="">Generic Template</option>
                    {competitions.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-admin"
                  disabled={submitting}
                >
                  {submitting ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
