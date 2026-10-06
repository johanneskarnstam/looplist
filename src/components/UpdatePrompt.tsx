import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { GitCommit, ExternalLink } from 'lucide-react';
import { Commit } from '../types';
import buildCommits from '../commits.json';

export const UpdatePrompt: React.FC = () => {
    const { t } = useTranslation();
    const [newCommits, setNewCommits] = useState<Commit[]>([]);
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: unknown) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error: unknown) {
            console.log('SW registration error', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            // Fetch the latest commits from the server (bypassing cache if possible)
            fetch(`/looplist/commits.json?t=${Date.now()}`)
                .then(res => res.json())
                .then((data: Commit[]) => {
                    if (data && data.length > 0) {
                        const currentHash = buildCommits[0]?.hash;
                        if (currentHash) {
                            const index = data.findIndex(c => c.hash === currentHash);
                            // If currentHash is found, show all commits before it (newer)
                            // If index is -1, show all (something might be wrong or user is very far behind)
                            const newer = index !== -1 ? data.slice(0, index) : data;
                            setNewCommits(newer);
                        } else {
                            setNewCommits([data[0]]);
                        }
                    }
                })
                .catch(err => console.error('Failed to fetch latest commits for update prompt:', err));
        }
    }, [needRefresh]);

    const close = () => {
        setNeedRefresh(false);
    };

    const handleUpdate = () => {
        updateServiceWorker(true);
    };

    if (!needRefresh) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('update.title', 'Update Available')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {t('update.message', 'A new version of the app is available. Click update to reload and get the latest features.')}
                    </p>

                    {newCommits.length > 0 && (
                        <div className="mb-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 overflow-hidden">
                            <div className="p-3 bg-blue-100/50 dark:bg-blue-900/30 flex items-center justify-between border-b border-blue-100 dark:border-blue-900/20">
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                    <GitCommit size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        {t('update.whatsNew', "What's new")}
                                    </span>
                                </div>
                                <a
                                    href="https://github.com/johanneskarnstam/looplist/commits/main"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                    GitHub <ExternalLink size={12} />
                                </a>
                            </div>
                            <div className="max-h-48 overflow-y-auto p-4 space-y-3">
                                {newCommits.map((commit) => (
                                    <div key={commit.hash} className="flex gap-3">
                                        <div className="w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-600 mt-2 flex-shrink-0" />
                                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-tight">
                                            {commit.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end items-center">
                        <button
                            onClick={close}
                            className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-sm font-medium"
                        >
                            {t('update.later', 'Later')}
                        </button>
                        <button
                            onClick={handleUpdate}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95 font-semibold text-sm"
                        >
                            {t('update.reload', 'Update & Reload')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
