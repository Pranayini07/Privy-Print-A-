import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Print.module.css';

export default function Print() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentFile, setCurrentFile] = useState(null);
    const [filesList, setFilesList] = useState([]);
    const [error, setError] = useState(null);
    const [showViewer, setShowViewer] = useState(false);
    const iframeRef = useRef(null);

    // Security: Prevent context menu and shortcuts
    useEffect(() => {
        const preventDefault = (e) => e.preventDefault();
        document.addEventListener('contextmenu', preventDefault);
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'u')) {
                e.preventDefault();
            }
        });
        return () => {
            document.removeEventListener('contextmenu', preventDefault);
            document.removeEventListener('keydown', preventDefault);
        };
    }, []);

    const handleFetch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setFilesList([]);

        if (!code || code.length < 3) {
            setError('Invalid code format.');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`/api/meta/${code}`);
            if (res.ok) {
                const data = await res.json();
                const files = data.files || [];

                if (files.length === 0) {
                    // Fallback for some legacy structure if meta returns empty but doc exists
                    // (Though API logic should handle this, good to be safe)
                    setError('No files found for this document.');
                } else {
                    setFilesList(files);
                    // Default to first file
                    setCurrentFile(files[0]);
                    setShowViewer(true);
                }
            } else {
                const data = await res.json();
                setError(data.error || 'Document not found or expired.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (file) => {
        setCurrentFile(file);
    };

    const handlePrint = () => {
        if (iframeRef.current) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
        }
    };

    // Helper to request specific file index
    const getViewerUrl = () => {
        if (!currentFile) return '';
        const indexParam = currentFile.index !== undefined ? `&fileIndex=${currentFile.index}` : '';
        const nameParam = currentFile.name ? `&file=${encodeURIComponent(currentFile.name)}` : '';
        return `/api/view/${code}?${nameParam}${indexParam}`;
    };

    return (
        <div className={styles.container}>
            <div className="bg-noise" />
            <Head>
                <title>PRIVY PRINT - View</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <main className={styles.main}>
                {!showViewer ? (
                    <>
                        <div className={styles.header}>
                            <h1 style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PRIVY PRINT</h1>
                            <p style={{ color: 'var(--text-muted)' }}>Enter the access code to view and print.</p>
                        </div>
                        <form onSubmit={handleFetch} className={styles.codeForm}>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="000-000"
                                className={styles.codeInput}
                                maxLength={7}
                                autoFocus
                            />
                            {error && (
                                <div className={styles.error}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    {error}
                                </div>
                            )}
                            <button type="submit" className={styles.fetchBtn} disabled={loading || code.length < 3}>
                                {loading ? 'Verifying...' : 'Access Document'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className={styles.viewerContainer}>
                        <div className={styles.toolbar}>
                            <button onClick={() => setShowViewer(false)} className={styles.backBtn}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                Exit Session
                            </button>

                            <div className={styles.warning}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                Printing Only • No Downloads
                            </div>

                            <button onClick={handlePrint} className={styles.printBtn}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                Print Document
                            </button>
                        </div>

                        <div className={styles.mainContent}>
                            {filesList.length > 1 && (
                                <aside className={styles.sidebar}>
                                    <div className={styles.sidebarTitle}>Attached Files ({filesList.length})</div>
                                    <div className={styles.fileList}>
                                        {filesList.map((file, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleFileSelect(file)}
                                                className={`${styles.fileItem} ${currentFile && (currentFile.index === file.index) ? styles.fileItemActive : ''}`}
                                            >
                                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                <span className={styles.fileName}>{file.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </aside>
                            )}

                            <div className={styles.frameWrapper}>
                                <iframe
                                    ref={iframeRef}
                                    src={getViewerUrl()}
                                    className={styles.iframe}
                                    title="Document Viewer"
                                />
                                <div className={styles.overlay} />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
