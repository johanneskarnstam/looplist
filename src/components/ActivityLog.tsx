import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ExternalLink, GitCommit } from 'lucide-react';
import commitsData from '../commits.json';

import { Commit } from '../types';

const commits = commitsData as Commit[];

const GITHUB_REPO = 'https://github.com/johanneskarnstam/looplist';

export const ActivityLog: React.FC = () => {
    const { t } = useTranslation();
    const displayedCommits = commits;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pt-4">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-200/50 dark:shadow-none">
                        <GitCommit size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {t('activity.title', 'Activity Log')}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {t('activity.subtitle', 'Recent updates and improvements to LoopList')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-4 space-y-8 pb-8">
                {displayedCommits.map((commit, index) => {
                    return (
                        <div key={commit.hash} className="ml-8 relative">
                            <span className="absolute -left-[41px] top-1.5 flex items-center justify-center w-5 h-5 bg-white dark:bg-gray-900 rounded-full ring-4 ring-white dark:ring-gray-900 border-2 border-gray-200 dark:border-gray-700">
                                <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                            </span>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all overflow-hidden group/card">
                                <div className="p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">
                                            {commit.message}
                                        </h3>
                                        <a
                                            href={`${GITHUB_REPO}/commit/${commit.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group px-3 py-1 rounded-full text-[11px] font-bold bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-mono hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center gap-1.5 border border-gray-100 dark:border-gray-700 w-fit"
                                        >
                                            {commit.hash.substring(0, 7)}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400 dark:text-gray-500">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={13} />
                                            <time dateTime={commit.date}>
                                                {new Date(commit.date).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                })}
                                            </time>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="pt-8 pb-12 flex justify-center">
                <a
                    href={`${GITHUB_REPO}/commits/main`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm hover:shadow-md font-semibold text-sm group"
                >
                    <span>{t('activity.viewAllGithub', 'View all commits on GitHub')}</span>
                    <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
        </div>
    );
};
