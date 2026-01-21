export interface AuthCredentials {
    username: string;
    password: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export interface RegisterData {
    username: string;
    password: string;
}
