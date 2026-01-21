import api from './api';
import type { AuthCredentials, AuthResponse, RegisterData } from '../types/auth';

export const authService = {
    login: async (credentials: AuthCredentials): Promise<AuthResponse> => {
        const loginData = new URLSearchParams();
        loginData.append('username', credentials.username);
        loginData.append('password', credentials.password);

        const response = await api.post('/auth/login', loginData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data;
    },

    register: async (data: RegisterData): Promise<void> => {
        await api.post('/auth/register', data);
    }
};
