import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../service/api';

const EditorPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [content, setContent] = useState<string>("");
    const [originalContent, setOriginalContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            if (!id) return;
            try {
                const downloadRes = await api.get(`/download/${id}`);
                const url = downloadRes.data.url;
                const textRes = await fetch(url);
                if (!textRes.ok) throw new Error("Failed to fetch content");
                const text = await textRes.text();

                setContent(text);
                setOriginalContent(text);

            } catch (err) {
                console.error(err);
                toast.error("Failed to load file");
                navigate('/drive');
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, [id, navigate]);

    const handleSave = async () => {
        if (!id) return;
        setIsSaving(true);
        try {
            await api.put(`/resources/${id}/content`, content, {
                headers: { 'Content-Type': 'text/plain' } // Backend reads raw body
            });
            setOriginalContent(content);
            toast.success("Saved");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [content, id]); 
    const hasChanges = content !== originalContent;

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#3e3e3e] shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-lg hover:bg-[#3e3e3e] text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-200">Untitled</span>
                        <span className="text-xs text-slate-500">{hasChanges ? "Unsaved changes" : "All changes saved"}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                           ${hasChanges
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20'
                                : 'bg-[#3e3e3e] text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    defaultLanguage="plaintext"
                    language="plaintext"
                    theme="vs-dark"
                    value={content}
                    onChange={(value) => setContent(value || "")}
                    options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 16 }
                    }}
                />
            </div>
        </div>
    );
};

export default EditorPage;
