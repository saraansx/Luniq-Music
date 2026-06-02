import React, { useState, useEffect } from 'react';
import './About.css';
import { useLanguage } from '../../context/LanguageContext';
import mainLogo from '../../assets/Main.png';
import saraansPfp from '../../assets/Credits/Saraans.jpg';
import licenseText from '../../../LicENSE?raw';

/* ── Commit History Component ── */
const CommitHistory: React.FC = () => {
    const { t } = useLanguage();
    const [commits, setCommits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCommits = async () => {
            try {
                if (window.ipcRenderer) {
                    const data = await window.ipcRenderer.invoke('get-github-commits');
                    if (data) setCommits(data);
                }
            } catch (err) {
                console.error('Error fetching commits:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchCommits();
    }, []);

    if (loading) {
        return (
            <div className="about-commits-loading">
                <div className="about-commits-spinner" />
                <span>{t('about.loadingCommits')}</span>
            </div>
        );
    }

    if (commits.length === 0) {
        return (
            <div className="about-commits-loading">
                <span>{t('about.failedCommits')}</span>
            </div>
        );
    }

    return (
        <div className="about-commits-list">
            {commits.map((c: any) => (
                <div 
                    key={c.sha} 
                    className="about-commit-item"
                    onClick={() => window.ipcRenderer?.invoke('open-external', c.html_url)}
                >
                    <span className="about-commit-msg">{c.commit.message}</span>
                    <div className="about-commit-meta">
                        <span className="about-commit-hash">{c.sha.substring(0, 7)}</span>
                        <span>•</span>
                        <span>{new Date(c.commit.author.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ── Commits Modal ── */
interface CommitsModalProps {
    onClose: () => void;
}

const CommitsModal: React.FC<CommitsModalProps> = ({ onClose }) => {
    const { t } = useLanguage();

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="about-modal-overlay" onClick={onClose}>
            <div className="about-modal-glass about-modal-glass--commits" onClick={(e) => e.stopPropagation()}>
                <div className="about-modal-scroll">
                    <h2 className="about-modal-name" style={{ marginBottom: '12px' }}>
                        {t('about.commitHistory')}
                    </h2>
                    <CommitHistory />
                </div>
                <div className="about-modal-close" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            </div>
        </div>
    );
};

/* ── About Modal ── */
interface AboutModalProps {
    onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const [version, setVersion] = useState('1.0.0');
    const [build, setBuild] = useState('');

    useEffect(() => {
        const getVersion = async () => {
            if (window.ipcRenderer) {
                const v = await window.ipcRenderer.invoke('get-app-version');
                if (v && typeof v === 'object') {
                    setVersion(v.version);
                    if (v.buildVersion) setBuild(v.buildVersion);
                } else if (typeof v === 'string') {
                    setVersion(v);
                }
            }
        };
        getVersion();

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="about-modal-overlay" onClick={onClose}>
            <div className="about-modal-glass" onClick={(e) => e.stopPropagation()}>
                <div className="about-modal-scroll">
                <img src={mainLogo} alt="Lune" className="about-modal-logo" />

                <h2 className="about-modal-name">Lune</h2>

                <p className="about-modal-desc">
                    {t('about.description')}
                </p>

                <div className="about-modal-links">
                    <button
                        className="about-modal-link-btn"
                        onClick={() => window.ipcRenderer?.invoke('open-external', 'https://github.com/saraansx/Lune-Music')}
                        title="GitHub"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                        </svg>
                        GitHub
                    </button>
                    <button
                        className="about-modal-link-btn about-modal-link-btn--discord"
                        onClick={() => window.ipcRenderer?.invoke('open-external', 'https://discord.gg/TardrVJT9N')}
                        title="Discord"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Discord
                    </button>
                </div>

                <div className="about-modal-divider" />

                <div className="about-modal-meta">
                    <span className="about-meta-label">{t('about.version')}</span>
                    <span className="about-meta-value">{version}</span>
                </div>
                {build && (
                    <div className="about-modal-meta">
                        <span className="about-meta-label">{t('about.buildNumber')}</span>
                        <span className="about-meta-value">{build}</span>
                    </div>
                )}
                <div className="about-modal-meta">
                    <span className="about-meta-label">{t('about.license')}</span>
                    <span
                        className="about-meta-value about-meta-link"
                        onClick={() => window.ipcRenderer?.invoke('open-external', 'https://github.com/saraansx/Lune-Music?tab=GPL-3.0-1-ov-file')}
                    >
                        GPL-3.0
                    </span>
                </div>
                <div className="about-modal-meta">
                    <span className="about-meta-label">{t('about.repository')}</span>
                    <span
                        className="about-meta-value about-meta-link"
                        onClick={() => window.ipcRenderer?.invoke('open-external', 'https://github.com/saraansx/Lune-Music')}
                    >
                        github.com/saraansx/Lune-Music
                    </span>
                </div>
                <div className="about-modal-meta">
                    <span className="about-meta-label">{t('about.bugReports')}</span>
                    <span
                        className="about-meta-value about-meta-link about-meta-link--discord"
                        onClick={() => window.ipcRenderer?.invoke('open-external', 'https://discord.gg/CVQ4bxK7P6')}
                    >
                        Discord#bugs
                    </span>
                </div>

                <div className="about-modal-divider" />

                <div className="about-credits-card">
                    <img src={saraansPfp} alt="Saraans" className="about-credits-card-avatar" />
                    <div className="about-credits-card-info">
                        <span className="about-credits-card-name">Saraans</span>
                        <span className="about-credits-card-desc">{t('about.saraans.desc')}</span>
                    </div>
                    <div className="about-credits-card-socials">
                        <button
                            className="about-credits-card-btn"
                            onClick={() => window.ipcRenderer?.invoke('open-external', 'https://github.com/saraansx')}
                            title="GitHub"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                            </svg>
                        </button>
                        <button
                            className="about-credits-card-btn"
                            onClick={() => window.ipcRenderer?.invoke('open-external', 'https://x.com/saraansx')}
                            title="X"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </button>
                        <button
                            className="about-credits-card-btn"
                            onClick={() => window.ipcRenderer?.invoke('open-external', 'https://www.instagram.com/saraan._.s/')}
                            title="Instagram"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="about-license-section">
                    <span className="about-license-heading">{t('about.licenseHeading')}</span>
                    <div className="about-license-box">
                        <pre className="about-license-text">{licenseText}</pre>
                    </div>
                </div>

                <p className="about-modal-footer">
                    {t('about.footer')} <span className="about-footer-heart">♥</span> {t('about.footerSuffix')}
                </p>
                </div>
            </div>
        </div>
    );
};

/* ── About Settings Card ── */
const About: React.FC = () => {
    const { t } = useLanguage();
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [showCommitsModal, setShowCommitsModal] = useState(false);

    return (
        <>
            <div className="settings-language-card about-lune-card">
                <div className="settings-account-header">
                    <h2 className="settings-account-title">{t('about.title')}</h2>
                    <p className="settings-account-description">{t('about.sub')}</p>
                </div>

                <div className="language-content">
                    {/* About Row */}
                    <div
                        className="settings-row about-nav-row"
                        onClick={() => setShowAboutModal(true)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="row-info">
                            <span className="row-label">{t('about.rowLabel')}</span>
                            <span className="row-sub">{t('about.rowSub')}</span>
                        </div>
                        <svg
                            className="about-chevron"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </div>

                    {/* Commits Row */}
                    <div
                        className="settings-row about-nav-row"
                        onClick={() => setShowCommitsModal(true)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="row-info">
                            <span className="row-label">{t('about.commitHistory')}</span>
                            <span className="row-sub">{t('about.commitsRowSub')}</span>
                        </div>
                        <svg
                            className="about-chevron"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </div>
                </div>
            </div>

            {showAboutModal && <AboutModal onClose={() => setShowAboutModal(false)} />}
            {showCommitsModal && <CommitsModal onClose={() => setShowCommitsModal(false)} />}
        </>
    );
};

export default About;
