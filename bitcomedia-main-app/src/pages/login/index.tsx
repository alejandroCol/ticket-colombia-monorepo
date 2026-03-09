import React, { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import CustomInput from "../../components/CustomInput";
import PrimaryButton from "../../components/PrimaryButton";
import { loginWithEmailAndPassword, getUserData, metaPixel } from "../../services";
import "./index.scss";
import logo from "../../assets/logo.png";

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
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
      newErrors.email = "El correo electrónico es requerido";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "El correo electrónico no es válido";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "La contraseña es requerida";
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = "La contraseña debe tener al menos 6 caracteres";
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

      // Check if user exists in Firestore
      const userData = await getUserData(userCredential.user.uid);

      if (!userData) {
        throw new Error("user-not-found");
      }

      // Trackear login exitoso
      metaPixel.trackLogin();

      // Authentication successful, navigation will be handled by MainLayout
      console.log("Login successful");
    } catch (error) {
      if (error instanceof Error) {
        const firebaseError = error as { code?: string };
        let errorMessage = "Error de autenticación. Intenta de nuevo.";

        if (
          firebaseError.code === "auth/user-not-found" ||
          firebaseError.code === "auth/wrong-password" ||
          error.message === "user-not-found"
        ) {
          errorMessage = "Correo electrónico o contraseña incorrectos.";
        } else if (firebaseError.code === "auth/too-many-requests") {
          errorMessage = "Demasiados intentos fallidos. Intenta más tarde.";
        }

        setErrors({ auth: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-logo">
          <img src={logo} alt="Ticket Colombia Logo" className="logo-image" />
        </div>

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

            <div className="form-group forgot-password">
              <Link to="/forget-password">¿Olvidaste tu contraseña?</Link>
            </div>

            <div className="form-group">
              <PrimaryButton type="submit" fullWidth loading={loading}>
                Iniciar sesión
              </PrimaryButton>
            </div>

            <div className="form-group signup-link">
              <p>
                ¿No tienes una cuenta? <Link to="/signup">Regístrate aquí</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
