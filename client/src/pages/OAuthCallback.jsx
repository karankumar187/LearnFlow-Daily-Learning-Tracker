import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const OAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginWithToken } = useAuth(); // We'll add this to AuthContext

    useEffect(() => {
        const token = searchParams.get('token');

        if (token) {
            handleOAuthLogin(token);
        } else {
            toast.error('Authentication failed. No token received.');
            navigate('/login');
        }
    }, [searchParams, navigate]);

    const handleOAuthLogin = async (token) => {
        try {
            await loginWithToken(token);
            toast.success('Successfully logged in!');
            navigate('/dashboard');
        } catch (error) {
            console.error('OAuth login error:', error);
            toast.error('Authentication failed.');
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">
                Securely logging you in...
            </h2>
            <p className="text-sm text-gray-500 mt-2">Please wait while we verify your credentials.</p>
        </div>
    );
};

export default OAuthCallback;
