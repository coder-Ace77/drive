import React, { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';

export const BackendDisclaimer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const checkBackend = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || '';
                // Construct root URL by removing /api/v1 suffix to checking the root / route
                // Logic: verify if the base implementation of the backend is reachable
                const rootUrl = apiUrl.replace(/\/api\/v1\/?$/, '/');

                if (rootUrl) {
                    await axios.get(rootUrl);
                }
            } catch (error) {
                console.error("Backend reachability check failed:", error);
                setIsOpen(true);
            }
        };

        checkBackend();
    }, []);

    return (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Connection Advisory">
            <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-full shrink-0">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="space-y-3">
                        <p className="text-slate-700 font-medium">
                            Backend server might be unreachable
                        </p>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            We detected an issue connecting to the server. If you are using a company network,
                            the backend might be blocked by a firewall.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        I Understand
                    </button>
                </div>
            </div>
        </Modal>
    );
};
