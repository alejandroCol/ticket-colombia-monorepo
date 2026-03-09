import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import { sendPasswordResetEmail } from '../../services';
import './index.scss';
import logo from '../../assets/logo.png';

const ForgetPasswordScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    email?: string;
    general?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: { email?: string } = {};
    let isValid = true;

    if (!email) {
      newErrors.email = 'El correo electrónico es requerido';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'El correo electrónico no es válido';
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
      // Send password reset email
      await sendPasswordResetEmail(email);
      
      // Show success message
      setSuccess(true);
      
      // Clear the form
      setEmail('');
      
    } catch (error) {
      if (error instanceof Error) {
        const firebaseError = error as { code?: string };
        let errorMessage = 'Error al enviar el correo. Intenta de nuevo.';

        if (firebaseError.code === 'auth/user-not-found') {
          errorMessage = 'No existe una cuenta con este correo electrónico.';
        } else if (firebaseError.code === 'auth/too-many-requests') {
          errorMessage = 'Demasiados intentos. Intenta más tarde.';
        } else if (firebaseError.code === 'auth/invalid-email') {
          errorMessage = 'El correo electrónico no es válido.';
        }
        
        setErrors({ general: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forget-password-screen">
      <div className="forget-password-container">
        <div className="forget-password-logo">
          <img src={logo} alt="Ticket Colombia Logo" className="logo-image" onClick={() => navigate('/')} />
        </div>

        <div className="forget-password-form-container">
          <h2>Recuperar contraseña</h2>
          <p className="forget-password-subtitle">
            Ingresa tu correo electrónico para recibir instrucciones de recuperación
          </p>

          {errors.general && <div className="auth-error">{errors.general}</div>}
          {success && (
            <div className="success-message">
              Se ha enviado un correo a <strong>{email}</strong> con instrucciones para recuperar tu contraseña.
              Revisa tu bandeja de entrada.
            </div>
          )}

          <form className="forget-password-form" onSubmit={handleSubmit}>
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
              <PrimaryButton type="submit" fullWidth loading={loading} disabled={success}>
                Enviar instrucciones
              </PrimaryButton>
            </div>
            
            <div className="form-group login-link">
              <p>¿Recordaste tu contraseña? <Link to="/login">Inicia sesión aquí</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgetPasswordScreen;
