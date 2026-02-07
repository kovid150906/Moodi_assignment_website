import { useState, useEffect } from 'react';
import { certificatesAPI } from '../api';
import Loading from '../components/ui/Loading';
import Particles from '../components/ui/Particles';
import TextRewind from '../components/ui/TextRewind';

const Certificates = () => {
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(null);

    useEffect(() => {
        loadCertificates();
    }, []);

    const loadCertificates = async () => {
        try {
            const response = await certificatesAPI.getAll();
            setCertificates(response.data.data || []);
        } catch (error) {
            console.error('Failed to load certificates:', error);
            setCertificates([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (certId, competitionName) => {
        setDownloading(certId);
        try {
            const response = await certificatesAPI.download(certId);

            // Create blob and download
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Certificate_${competitionName.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download certificate');
        } finally {
            setDownloading(null);
        }
    };

    if (loading) {
        return <Loading />;
    }

    return (
        <>
            {/* Particles Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <Particles
                    particleColors={["#ffffff"]}
                    particleCount={200}
                    particleSpread={10}
                    speed={0.1}
                    particleBaseSize={100}
                    moveParticlesOnHover={false}
                    alphaParticles={true}
                    disableRotation={false}
                    pixelRatio={1}
                />
            </div>

            {/* TextRewind Background Text */}
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, pointerEvents: 'none', opacity: 0.2 }}>
                <TextRewind text="MOOD INDIGO" />
            </div>

            <div className="relative z-10 px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 text-white animate-fadeIn">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 uppercase tracking-widest">MY CERTIFICATES</h1>
                        <p className="text-sm sm:text-base text-white/60">Download your earned certificates</p>
                    </div>

                    {certificates && certificates.length === 0 ? (
                        <div className="p-6 sm:p-8 text-center rounded-lg">
                            <div className="text-4xl sm:text-5xl mb-4">📜</div>
                            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">No Certificates Yet</h3>
                            <p className="text-sm sm:text-base text-white/60">
                                Participate in competitions and win to earn certificates!
                            </p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {certificates.map((cert) => (
                                <div key={cert.id} className="p-4 sm:p-6 rounded-lg transition-all duration-300 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)]">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white flex items-center justify-center">
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                            </svg>
                                        </div>
                                        {cert.result_status === 'WINNER' && (
                                            <span className="text-xs font-bold uppercase tracking-wider text-white px-2 py-0.5 border border-white/30 rounded">
                                                {cert.position ? `#${cert.position}` : 'Winner'}
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="font-semibold mb-1 text-white text-sm sm:text-base">{cert.competition_name}</h3>
                                    <p className="text-xs sm:text-sm text-white/60 mb-4">{cert.city_name}</p>

                                    <div className="flex items-center justify-between text-xs text-white/50 mb-4">
                                        <span>Issued: {new Date(cert.created_at).toLocaleDateString()}</span>
                                    </div>

                                    <button
                                        onClick={() => handleDownload(cert.id, cert.competition_name)}
                                        disabled={downloading === cert.id}
                                        className="w-full text-xs sm:text-sm flex items-center justify-center gap-2 px-4 py-2 sm:py-3 bg-white text-black font-bold uppercase tracking-wider hover:bg-white/90 transition-all disabled:opacity-50"
                                    >
                                        {downloading === cert.id ? (
                                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Download PDF
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Certificates;
