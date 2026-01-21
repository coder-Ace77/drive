import React from 'react';
import type { ReactNode } from 'react';

interface AuthBackgroundProps {
    children: ReactNode;
}

const AuthBackground: React.FC<AuthBackgroundProps> = ({ children }) => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 overflow-hidden relative">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

            <div className="relative w-full max-w-md">
                {children}
            </div>
        </div>
    );
};

export default AuthBackground;
