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
    // const [fileName, setFileName] = useState("");
    // const [language, setLanguage] = useState("plaintext");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch file content
    useEffect(() => {
        const fetchContent = async () => {
            if (!id) return;
            try {
                // Get Metadata first to determine type/name/language
                // But we don't have a single-get endpoint for metadata without content?
                // Actually `get_tree` or `shared` but we can't easily find it by ID efficiently if not in tree.
                // We'll just fetch content first, assuming it's editable. 
                // Wait, if it's large binary, we might crash?
                // For now, let's assume we navigate here only for text files.
                // We can fetch metadata via `get_download_link`? No.

                // Let's rely on standard fetch.
                const downloadRes = await api.get(`/download/${id}`);
                const url = downloadRes.data.url;

                // Fetch actual text
                const textRes = await fetch(url);
                if (!textRes.ok) throw new Error("Failed to fetch content");
                const text = await textRes.text();

                setContent(text);
                setOriginalContent(text);

                // Determine language from ID? We lack filename here unless passed in state?
                // We could pass state in navigate location?
                // Or we fetch tree/search to find Name? 
                // Let's try to get resources info (we need metadata endpoint eventually).
                // For now, we rely on the URL or the previous page passing state?
                // Navigating with state is standard.

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

    // Hack to get filename/language: useLocation state? 
    // Or add `GET /resources/{id}` metadata endpoint?
    // We already have `GET /folders/{id}` but not single file metadata separate from tree.
    // Let's implement basic Extension detection if we had the name.
    // I highly recommend adding a `GET /resources/{id}/metadata` or reuse something.
    // Buuuut, for now, I'll update `get_download_link` return? No.
    // Let's assume passed via state or use `location.state`.

    // ...
    // Wait, the `download` endpoint returns URL. The filename is in the Content-Disposition header of the response from S3?
    // Not easily accessible to JS fetch if CORS doesn't expose it.

    // PLAN B: Update `DrivePage` to pass `{ type: 'file', name: 'foo.ts', ... }` in navigation state.

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

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [content, id]); // Re-bind when content changes? No, handleSave uses ref or current state? 
    // State in closure problem? Yes. Use Ref or dependency.
    // Ideally use useCallback for handleSave.

    const hasChanges = content !== originalContent;

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden">
            {/* Header */}
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

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    defaultLanguage="plaintext" // We need to detect this!
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
