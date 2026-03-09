import React, { useState } from 'react';
import type { FormEvent } from 'react';
import CustomInput from '@components/CustomInput';
import PrimaryButton from '@components/PrimaryButton';
import TopNavBar from '@TopNavBar';
import { loginWithEmailAndPassword, hasAdminAccess, logoutUser } from '@services';
import './index.scss';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    auth?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    let isValid = true;

    if (!email) {
      newErrors.email = 'El correo electrónico es requerido';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'El correo electrónico no es válido';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'La contraseña es requerida';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});
    
    try {
      // Authenticate user
      const userCredential = await loginWithEmailAndPassword(email, password);
      
      // Check if user has admin role
      const isAdmin = await hasAdminAccess(userCredential.user.uid);
      
      if (!isAdmin) {
        // User doesn't have admin role - log them out and show error
        await logoutUser();
        setErrors({ 
          auth: 'No tienes los permisos necesarios para acceder al panel de administración.' 
        });
        return;
      }
      
      // If we get here, user is authenticated and has admin role
      // The MainLayout component will handle the navigation
      console.log('Login successful - Admin access granted');
      
    } catch (error) {
      if (error instanceof Error) {
        const firebaseError = error as { code?: string };
        let errorMessage = 'Error de autenticación. Intenta de nuevo.';

        if (
          firebaseError.code === 'auth/user-not-found' ||
          firebaseError.code === 'auth/wrong-password'
        ) {
          errorMessage = 'Correo electrónico o contraseña incorrectos.';
        } else if (firebaseError.code === 'auth/too-many-requests') {
          errorMessage = 'Demasiados intentos fallidos. Intenta más tarde.';
        }
        
        setErrors({ auth: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <TopNavBar logoOnly={true} />
      <div className="login-container">
        <div className="login-form-container">
          <h2>Iniciar sesión</h2>
          <p className="login-subtitle">
            Ingresa tus credenciales para acceder
          </p>

          {errors.auth && <div className="auth-error">{errors.auth}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <CustomInput
                type="email"
                name="email"
                label="Correo electrónico"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
              />
            </div>

            <div className="form-group">
              <CustomInput
                type="password"
                name="password"
                label="Contraseña"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                required
              />
            </div>

            <div className="form-group">
              <PrimaryButton type="submit" fullWidth loading={loading}>
                Iniciar sesión
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
