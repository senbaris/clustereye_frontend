import axios from 'axios';

const API_URL = 'http://localhost';

export interface LoginResponse {
  success: boolean;
  token: string;
  user?: {
    username: string;
    given_name?: string;
  };
}

export const loginUser = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await axios.post(`${API_URL}/login`, {
    username,
    password
  });
  
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    const user = {
      username: username,
      given_name: username
    };
    localStorage.setItem('user', JSON.stringify(user));
    
    return {
      success: true,
      token: response.data.token,
      user: user
    };
  }
  
  throw new Error('Login failed');
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
}; 