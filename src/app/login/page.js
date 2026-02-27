'use client';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #080c1a 0%, #0f172a 50%, #1e1b4b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '1.5rem',
        border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: '380px',
        width: '90%',
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '0.5rem',
        }}>
          📊
        </div>
        <h1 style={{
          color: '#fff',
          fontSize: '1.75rem',
          fontWeight: 800,
          marginBottom: '0.25rem',
        }}>
          InvestScope
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.85rem',
          marginBottom: '2rem',
        }}>
          Analyse d&apos;investissement mondiale
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            color: '#fca5a5',
            fontSize: '0.8rem',
          }}>
            {error === 'AccessDenied'
              ? 'Accès refusé. Seul le compte autorisé peut se connecter.'
              : 'Erreur de connexion. Réessayez.'}
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.875rem 1.5rem',
            background: '#fff',
            color: '#1f2937',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Se connecter avec Google
        </button>

        <p style={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '0.7rem',
          marginTop: '2rem',
        }}>
          Accès restreint
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#080c1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}>
        Chargement...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
