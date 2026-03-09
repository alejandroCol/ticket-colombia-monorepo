import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import Loader from '../../components/Loader';
import TopNavBar from '../../containers/TopNavBar';
import { getCurrentUser, getUserData, updateUserDocument } from '../../services';
import type { UserData } from '../../services/types';
import './index.scss';

const EditProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    general?: string;
  }>({});

  useEffect(() => {
    // Get current user data
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          // Redirect to login if not authenticated
          navigate('/login');
          return;
        }

        const userData = await getUserData(currentUser.uid);
        if (userData) {
          // Populate form with user data
          setName(userData.name?.toString() || '');
          setEmail(userData.email || '');
          setPhone(userData.phone?.toString() || '');
          setCity(userData.city?.toString() || '');
          setAddress(userData.address?.toString() || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setErrors({ general: 'Error al cargar los datos del perfil' });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const validateForm = (): boolean => {
    const newErrors: { 
      name?: string;
      phone?: string;
      address?: string;
      city?: string; 
    } = {};
    let isValid = true;

    if (!name) {
      newErrors.name = 'El nombre es requerido';
      isValid = false;
    }

    if (!phone) {
      newErrors.phone = 'El número de celular es requerido';
      isValid = false;
    } else if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Ingresa un número de celular válido (10 dígitos)';
      isValid = false;
    }

    if (!city) {
      newErrors.city = 'La ciudad es requerida';
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

    setSubmitting(true);
    setErrors({});
    
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Update user document in Firestore
      const updatedData: Partial<UserData> = {
        name,
        phone,
        city,
        address
      };
      
      await updateUserDocument(currentUser.uid, updatedData);
      
      // Set success state
      setSuccess(true);
      
      // Redirect to profile after a delay
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ general: 'Error al actualizar el perfil. Intenta de nuevo.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader size="large" color="accent" fullScreen />;
  }

  return (
    <div className="edit-profile-screen">
      <TopNavBar logoOnly />
      <div className="edit-profile-container">
        <div className="edit-profile-form-container">
          <h2>Editar perfil</h2>
          <p className="edit-profile-subtitle">
            Actualiza tu información personal
          </p>

          {errors.general && <div className="auth-error">{errors.general}</div>}
          {success && <div className="success-message">¡Perfil actualizado correctamente! Redirigiendo...</div>}

          <form className="edit-profile-form" onSubmit={handleSubmit}>
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
                disabled={true} // Email cannot be changed
              />
              <small className="email-hint">El correo electrónico no se puede modificar</small>
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
                type="text"
                name="city"
                label="Ciudad"
                placeholder="Tu ciudad"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                error={errors.city}
                required
              />
            </div>
            
            <div className="form-group">
              <CustomInput
                type="text"
                name="address"
                label="Dirección"
                placeholder="Tu dirección"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={errors.address}
              />
            </div>

            <div className="form-group">
              <PrimaryButton type="submit" fullWidth loading={submitting} disabled={success}>
                Guardar cambios
              </PrimaryButton>
            </div>
            
            <div className="form-group cancel-link">
              <button 
                type="button" 
                className="cancel-button" 
                onClick={() => navigate('/profile')}
                disabled={submitting || success}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;
