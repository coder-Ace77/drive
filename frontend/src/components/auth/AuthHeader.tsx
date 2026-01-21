import { HardDrive } from 'lucide-react';

const AuthHeader = () => {
    return (
        <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200 mb-4 transform hover:rotate-12 transition-transform cursor-pointer">
                <HardDrive className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Drive</h1>
            <p className="text-slate-500 mt-2 font-medium">Your files, secured in the cloud.</p>
        </div>
    );
};

export default AuthHeader;
