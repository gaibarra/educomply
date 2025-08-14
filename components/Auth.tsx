import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-app-gradient">
            <div className="w-full max-w-md p-8 space-y-8 glass shadow-2xl rounded-xl border border-white/10 animate-fade-in">
                <div>
                    <h2 className="text-3xl font-extrabold text-center text-gradient">
                        Bienvenido a EduComply
                    </h2>
                    <p className="mt-2 text-sm text-center text-slate-200/80">
                        Inicie sesión para continuar
                    </p>
                </div>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="email" className="text-sm font-medium text-slate-200">
                            Correo Electrónico
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="w-full px-3 py-2 border border-white/20 bg-white/10 text-slate-100 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary focus:border-transparent"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="password" className="text-sm font-medium text-slate-200">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="w-full px-3 py-2 border border-white/20 bg-white/10 text-slate-100 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary focus:border-transparent"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    {error && (
                         <div className="p-3 text-sm text-center text-white rounded-md state-gradient-error">
                            {error}
                        </div>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-400/30 disabled:bg-slate-500/50"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'}}
                        >
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Auth;
