import React from 'react';

interface AuthFooterProps {
    isLogin: boolean;
    onToggle: () => void;
}

const AuthFooter: React.FC<AuthFooterProps> = ({ isLogin, onToggle }) => {
    return (
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-600 text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                    type="button"
                    onClick={onToggle}
                    className="ml-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                    {isLogin ? 'Register now' : 'Sign in here'}
                </button>
            </p>
        </div>
    );
};

export default AuthFooter;
