import React from 'react';

interface AuthErrorMessageProps {
    error: string;
}

const AuthErrorMessage: React.FC<AuthErrorMessageProps> = ({ error }) => {
    if (!error) return null;

    return (
        <div className={`mb-6 p-3 rounded-xl text-sm border ${error.includes('created')
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-red-50 text-red-600 border-red-100'
            }`}>
            {error}
        </div>
    );
};

export default AuthErrorMessage;
