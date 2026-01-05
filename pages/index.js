import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useJsApiLoader } from '@react-google-maps/api';
import styles from '../styles/Home.module.css';

const LIBRARIES = ['places'];

export default function Home() {
    // ==========================================
    // STATE & LOGIC (PRESERVED)
    // ==========================================
    const [files, setFiles] = useState([]);
    const [duration, setDuration] = useState(15);
    const [useCustomDuration, setUseCustomDuration] = useState(false);
    const [customDuration, setCustomDuration] = useState('');
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null); // { code, expiresAt, files }
    const [history, setHistory] = useState([]);

    // Note: Map logic was present but unused in UI. Preserving loader for consistency.
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: LIBRARIES,
    });

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('doc_history') || '[]');
        setHistory(saved.sort((a, b) => b.uploadedAt - a.uploadedAt));
    }, []);

    const saveToHistory = (doc) => {
        const newHistory = [doc, ...history];
        setHistory(newHistory);
        localStorage.setItem('doc_history', JSON.stringify(newHistory));
    };

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files || []);
        setFiles(prevFiles => {
            const combined = [...prevFiles];
            newFiles.forEach(newFile => {
                const exists = combined.some(f =>
                    f.name === newFile.name && f.size === newFile.size
                );
                if (!exists) combined.push(newFile);
            });
            return combined;
        });
        e.target.value = '';
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getFileType = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        const typeMap = { 'pdf': 'PDF', 'doc': 'Word', 'docx': 'Word', 'png': 'Image', 'jpg': 'Image', 'jpeg': 'Image' };
        return typeMap[ext] || ext.toUpperCase();
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (uploading) return;
        if (!files || files.length === 0) {
            alert('Please select at least one file');
            return;
        }

        const finalDuration = useCustomDuration ? parseInt(customDuration) : parseInt(duration);
        if (useCustomDuration && (!customDuration || finalDuration < 1 || finalDuration > 1440)) {
            alert('Please enter a valid duration between 1 and 1440 minutes');
            return;
        }

        const filesToUpload = files.filter(file => file instanceof File && file.size > 0);
        if (filesToUpload.length === 0) {
            alert('No valid files selected.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        filesToUpload.forEach((file) => formData.append('files', file));
        formData.append('duration', finalDuration);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                const doc = { ...data, uploadedAt: Date.now() };
                setResult(doc);
                saveToHistory(doc);
                setTimeout(() => {
                    setFiles([]);
                    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
                }, 100);
            } else {
                alert('Upload failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Error uploading files: ' + (err.message || 'Network error'));
        } finally {
            setUploading(false);
        }
    };

    const copyCode = () => {
        if (result) {
            navigator.clipboard.writeText(result.code);
            alert('Code copied!');
        }
    };

    const isExpired = (timestamp) => Date.now() > timestamp;

    const handleForceExpire = async (code) => {
        if (!confirm('Are you sure you want to expire this document? It will no longer be accessible.')) return;
        try {
            const res = await fetch(`/api/expire/${code}`, { method: 'POST' });
            if (res.ok) {
                const updatedHistory = history.map(doc =>
                    doc.code === code ? { ...doc, expiresAt: Date.now() - 1000, status: 'expired' } : doc
                );
                setHistory(updatedHistory);
                localStorage.setItem('doc_history', JSON.stringify(updatedHistory));
                alert('Document expired successfully');
            } else {
                alert('Failed to expire document.');
            }
        } catch (err) {
            alert('Error expiring document');
        }
    };

    // ==========================================
    // UI RENDER
    // ==========================================
    return (
        <div className={styles.container}>
            <div className="bg-noise" />
            <Head>
                <title>Privy Print | Secure Document Printing</title>
                <meta name="description" content="Secure, private document printing without sharing files." />
            </Head>

            <main className={styles.main}>

                {/* HERO SECTION */}
                <section className={styles.hero}>
                    <h1 className={styles.heroTitle}>
                        <span className={styles.heroProjectName} style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            PRIVY PRINT
                        </span>
                        Secure. Private. Instant.
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Print your confidential documents securely without sharing files permanently.
                        Generate a time-bound access code and print anywhere.
                    </p>
                    <div className={styles.heroButtons}>
                        <button
                            onClick={() => document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' })}
                            className={styles.primaryBtn}
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            Upload Document
                        </button>
                        <Link href="/print" className={styles.secondaryBtn}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            Enter Access Code
                        </Link>
                        <a href="https://www.google.com/maps/search/xerox+print+shop+near+me" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Find Nearby Shops
                        </a>
                    </div>
                </section>

                {/* UPLOAD APP SECTION */}
                <section id="upload-section" className={styles.appSection}>
                    <div className={styles.uploadCard}>

                        <form onSubmit={handleUpload} className={styles.formGroup}>
                            <div className={styles.formGroup}>
                                <label>Upload Documents</label>
                                <div className={styles.fileInput} onClick={() => document.getElementById('file-input').click()}>
                                    <div className="glow-container">
                                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1" style={{ opacity: 0.8 }}>
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                    </div>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Click to Browse Files</span>
                                    <input
                                        id="file-input"
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                        multiple
                                        style={{ display: 'none' }}
                                    />
                                </div>

                                {files.length > 0 && (
                                    <div className={styles.fileList}>
                                        {files.map((file, index) => (
                                            <div key={index} className={styles.fileItem}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span className={styles.fileName}>{file.name}</span>
                                                    <span className={styles.fileMeta}>{getFileType(file.name)} • {formatFileSize(file.size)}</span>
                                                </div>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(index); }} className={styles.removeFileBtn}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="separator-soft" />

                            <div className={styles.formGroup}>
                                <label>Expiry Time</label>
                                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                        <input type="radio" checked={!useCustomDuration} onChange={() => setUseCustomDuration(false)} style={{ accentColor: 'var(--accent-primary)' }} /> Preset
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                        <input type="radio" checked={useCustomDuration} onChange={() => setUseCustomDuration(true)} style={{ accentColor: 'var(--accent-primary)' }} /> Custom
                                    </label>
                                </div>

                                {!useCustomDuration ? (
                                    <select className={styles.select} value={duration} onChange={(e) => setDuration(e.target.value)}>
                                        {[5, 10, 15, 30, 60, 120, 1440].map(m => (
                                            <option key={m} value={m}>{m} Minutes {m >= 60 ? `(${Math.round(m / 60)}hr)` : ''}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="number"
                                        className={styles.select}
                                        value={customDuration}
                                        onChange={(e) => setCustomDuration(e.target.value)}
                                        placeholder="Minutes (1-1440)"
                                        min="1" max="1440"
                                    />
                                )}
                            </div>

                            <button type="submit" className={styles.uploadBtn} disabled={uploading || files.length === 0}>
                                {uploading ? 'Encrypting & Uploading...' : 'Generate Secure Code'}
                            </button>
                        </form>

                        {/* RESULT CARD */}
                        {result && (
                            <div className={styles.successCard}>
                                <h3 style={{ color: 'var(--success)', marginBottom: '1rem', fontWeight: 700, letterSpacing: '0.05em' }}>READY FOR PRINTING</h3>
                                <div className={styles.codeDisplay}>{result.code}</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <button onClick={copyCode} className={styles.secondaryBtn}>
                                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                        Copy Code
                                    </button>
                                </div>
                                <div className={styles.expiryWarning}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                        Expires at {new Date(result.expiresAt).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* HISTORY SECTION */}
                    {history.length > 0 && (
                        <div className={styles.historySection}>
                            <h3 style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Recent Sessions</h3>
                            <ul className={styles.historyList}>
                                {history.map((doc, i) => (
                                    <li key={i} className={styles.historyItem} style={{ opacity: isExpired(doc.expiresAt) ? 0.6 : 1 }}>
                                        <div>
                                            <div className={styles.filename}>{doc.originalName || (doc.files && doc.files.length > 0 ? `${doc.files.length} Files` : 'Document')}</div>
                                            <div className={styles.meta} style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                {isExpired(doc.expiresAt) ? <span className={styles.pillExpired}>EXPIRED</span> : <span className={styles.pillSuccess}>ACTIVE</span>}
                                                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {!isExpired(doc.expiresAt) && (
                                                <>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>{doc.code}</span>
                                                    <button onClick={() => handleForceExpire(doc.code)} className={styles.removeFileBtn} title="Revoke Access">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                {/* INFO / ABOUT SECTION */}
                <section className={styles.section}>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoCard}>
                            <div className={styles.infoTitle}>
                                <svg width="24" height="24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                                Privacy First
                            </div>
                            <p className={styles.infoText}>Documents are encrypted and stored temporarily. Once expired, they are permanently deleted from our servers.</p>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoTitle}>
                                <svg width="24" height="24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                Instant Access
                            </div>
                            <p className={styles.infoText}>No signup required. Just upload, get a code, and enter it at the print shop to access your files securely.</p>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoTitle}>
                                <svg width="24" height="24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                Location Aware
                            </div>
                            <p className={styles.infoText}>Find nearby print shops and xerox centers with our integrated map features.</p>
                        </div>
                    </div>
                </section>

                {/* FAQ SECTION */}
                <section className={styles.section}>
                    <h2 className={styles.sectionHeader}>Frequently Asked Questions</h2>
                    <div className={styles.faqSection}>
                        <div className={styles.accordion}>
                            {[
                                { q: "Is my document stored permanently?", a: "No. Your documents are stored only for the duration you select (e.g., 15 minutes). After that, they are permanently deleted." },
                                { q: "Can print shops download my file?", a: "The print shop view is restricted to 'View & Print' only to prevent unauthorized downloading, though they must download to print in some cases, the link expires immediately." },
                                { q: "Do I need an account?", a: "No, Privy Print is completely anonymous and does not require any account creation." }
                            ].map((item, i) => (
                                <details key={i} className={styles.accordionItem}>
                                    <summary className={styles.accordionHeader}>
                                        {item.q}
                                    </summary>
                                    <div className={styles.accordionContent}>{item.a}</div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <footer className={styles.footer}>
                    <div className={styles.footerContent}>
                        <h3 className={styles.heroProjectName} style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '-0.02em' }}>PRIVY PRINT</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Secure Document Printing Infrastructure</p>
                        <div className={styles.footerLinks}>
                            <Link href="#" className={styles.footerLink}>About</Link>
                            <Link href="#" className={styles.footerLink}>Privacy</Link>
                            <Link href="#" className={styles.footerLink}>Terms</Link>
                        </div>
                        <p style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '1rem' }}>
                            Google Technologies Used: Next.js, Google Maps Platform<br />
                            © {new Date().getFullYear()} Privy Print Project
                        </p>
                    </div>
                </footer>
            </main>
        </div>
    );
}
