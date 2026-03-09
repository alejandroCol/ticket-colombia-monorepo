import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import { createUserWithEmailAndPassword, metaPixel } from '../../services';
import './index.scss';
import logo from '../../assets/logo.png';

const SignupScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    auth?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: { 
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string; 
    } = {};
    let isValid = true;

    if (!name) {
      newErrors.name = 'El nombre es requerido';
      isValid = false;
    }

    if (!email) {
      newErrors.email = 'El correo electrónico es requerido';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'El correo electrónico no es válido';
      isValid = false;
    }

    if (!phone) {
      newErrors.phone = 'El número de celular es requerido';
      isValid = false;
    } else if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Ingresa un número de celular válido (10 dígitos)';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'La contraseña es requerida';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
      isValid = false;
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
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
      // Create new user
      await createUserWithEmailAndPassword(email, password, name, phone);
      
      // Trackear registro completado
      metaPixel.trackCompleteRegistration();
      
      // Set success state and redirect to login after a delay
      setSuccess(true);
      
      // Redirect to login after 2 seconds to show success message
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error) {
      if (error instanceof Error) {
        const firebaseError = error as { code?: string };
        let errorMessage = 'Error al crear la cuenta. Intenta de nuevo.';

        if (firebaseError.code === 'auth/email-already-in-use') {
          errorMessage = 'Este correo electrónico ya está registrado.';
        }
        
        setErrors({ auth: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-screen">
      <div className="signup-container">
        <div className="signup-logo">
          <img src={logo} alt="Ticket Colombia Logo" className="logo-image" />
        </div>

        <div className="signup-form-container">
          <h2>Crear cuenta</h2>
          <p className="signup-subtitle">
            Crea una cuenta para acceder a la plataforma
          </p>

          {errors.auth && <div className="auth-error">{errors.auth}</div>}
          {success && <div className="success-message">¡Cuenta creada exitosamente! Redirigiendo a la página principal...</div>}

          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <CustomInput
                type="text"
                name="name"
                label="Nombre completo"
                placeholder="Tu nombre completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                required
              />
            </div>
            
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
                type="tel"
                name="phone"
                label="Número de celular"
                placeholder="Ej. 3001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
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
              <CustomInput
                type="password"
                name="confirmPassword"
                label="Confirmar contraseña"
                placeholder="Confirma tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                required
              />
            </div>

            <div className="form-group">
              <PrimaryButton type="submit" fullWidth loading={loading} disabled={success}>
                Crear cuenta
              </PrimaryButton>
            </div>
            
            <div className="form-group login-link">
              <p>¿Ya tienes una cuenta? <Link to="/login">Inicia sesión aquí</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupScreen;
