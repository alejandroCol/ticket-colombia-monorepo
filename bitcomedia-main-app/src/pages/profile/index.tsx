import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUser,
  getUserData,
  logoutUser,
  sendPasswordResetEmail,
} from "../../services";
import AccountlessState from "../../containers/AccountlessState";
import BottomNavBar from "../../containers/BottomNavBar";
import TopNavBar from "../../containers/TopNavBar";
import WhatsAppButton from "../../components/WhatsAppButton";
import Loader from "../../components/Loader";
import {
  ProfileIconArrowBack,
  ProfileIconMail,
  ProfileIconPhone,
  ProfileIconLocation,
  ProfileIconEdit,
  ProfileIconKey,
  ProfileIconLogout,
  ProfileIconSupport,
  ProfileIconChevronRight,
  ProfileIconInstagram,
  ProfileIconTikTok,
  ProfileIconSparkle,
  ProfileIconUserBadge,
} from "../../components/ProfileScreenIcons";
import "./index.scss";
import type { UserData } from "../../services";

const ProfileScreen: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [passwordResetSent, setPasswordResetSent] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthStatus = async () => {
      const user = getCurrentUser();

      if (user) {
        setIsAuthenticated(true);

        try {
          const userDataResult = await getUserData(user.uid);
          setUserData(userDataResult);
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error);
        }
      }

      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setIsAuthenticated(false);
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (userData?.email) {
        await sendPasswordResetEmail(userData.email);
        setPasswordResetSent(true);
        setErrorMessage(null);

        setTimeout(() => {
          setPasswordResetSent(false);
        }, 5000);
      }
    } catch (error) {
      console.error("Error al enviar correo de cambio de contraseña:", error);
      setErrorMessage("Error al enviar correo de cambio de contraseña");

      setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    }
  };

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (!isAuthenticated) {
    return (
      <div className="profile-screen profile-screen--guest">
        <TopNavBar isAuthenticated={isAuthenticated} />

        <div className="profile-content profile-content--guest">
          <div className="profile-guest-hero" aria-hidden>
            <ProfileIconSparkle className="profile-guest-hero__deco" size={32} />
          </div>
          <AccountlessState
            title="Tu espacio en Ticket Colombia"
            message="Crea una cuenta o inicia sesión para guardar tus datos, ver tus entradas y comprar más rápido."
            benefits={[
              "Perfil y datos guardados",
              "Acceso a tus boletos",
              "Checkout más ágil",
              "Novedades de eventos",
            ]}
            icon="🎭"
          />
          <div className="bottom-nav-spacer" />
        </div>

        <BottomNavBar />
      </div>
    );
  }

  const displayName = userData?.name?.trim() || "Usuario";
  const initial = (userData?.name?.trim()?.charAt(0) || "U").toUpperCase();

  return (
    <div className="profile-screen profile-screen--authenticated">
      <TopNavBar isAuthenticated={isAuthenticated} />

      <main className="profile-main">
        <header className="profile-hero">
          <div className="profile-hero__toolbar">
            <button
              type="button"
              className="profile-back-link"
              onClick={() => navigate("/")}
            >
              <ProfileIconArrowBack size={20} />
              <span>Inicio</span>
            </button>
          </div>

          <div className="profile-hero__layout">
            <div className="profile-hero__avatar-ring" aria-hidden>
              <div className="profile-hero__avatar">{initial}</div>
            </div>
            <div className="profile-hero__text">
              <p className="profile-hero__eyebrow">Mi perfil</p>
              <h1 className="profile-hero__name">{displayName}</h1>
              {userData?.email ? (
                <p className="profile-hero__email">{userData.email}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="profile-body">
          <div className="profile-body__pairs">
          <section className="profile-panel" aria-labelledby="profile-data-heading">
            <div className="profile-panel__head">
              <ProfileIconUserBadge
                className="profile-panel__head-icon"
                size={22}
                title="Tus datos"
              />
              <h2 id="profile-data-heading" className="profile-panel__title">
                Tus datos
              </h2>
            </div>
            <ul className="profile-data-list">
              <li className="profile-data-row">
                <span className="profile-data-row__icon" aria-hidden>
                  <ProfileIconMail size={20} />
                </span>
                <div className="profile-data-row__text">
                  <span className="profile-data-row__label">Correo</span>
                  <span className="profile-data-row__value">
                    {userData?.email || "—"}
                  </span>
                </div>
              </li>
              <li className="profile-data-row">
                <span className="profile-data-row__icon" aria-hidden>
                  <ProfileIconPhone size={20} />
                </span>
                <div className="profile-data-row__text">
                  <span className="profile-data-row__label">Teléfono</span>
                  <span className="profile-data-row__value">
                    {userData?.phone?.trim() || "Sin teléfono"}
                  </span>
                </div>
              </li>
              <li className="profile-data-row profile-data-row--last">
                <span className="profile-data-row__icon" aria-hidden>
                  <ProfileIconLocation size={20} />
                </span>
                <div className="profile-data-row__text">
                  <span className="profile-data-row__label">Ciudad</span>
                  <span className="profile-data-row__value">
                    {userData?.city?.trim() || "Sin ubicación"}
                  </span>
                </div>
              </li>
            </ul>
          </section>

          <section className="profile-panel" aria-labelledby="profile-account-heading">
            <div className="profile-panel__head">
              <ProfileIconKey
                className="profile-panel__head-icon"
                size={22}
                title="Cuenta"
              />
              <h2 id="profile-account-heading" className="profile-panel__title">
                Cuenta
              </h2>
            </div>
            <nav className="profile-action-list" aria-label="Acciones de cuenta">
              <button
                type="button"
                className="profile-action-row profile-action-row--primary"
                onClick={() => navigate("/editar-perfil")}
              >
                <span className="profile-action-row__icon" aria-hidden>
                  <ProfileIconEdit size={21} />
                </span>
                <span className="profile-action-row__label">Editar perfil</span>
                <ProfileIconChevronRight
                  className="profile-action-row__chevron"
                  size={18}
                />
              </button>
              <button
                type="button"
                className="profile-action-row"
                onClick={handleChangePassword}
              >
                <span className="profile-action-row__icon" aria-hidden>
                  <ProfileIconKey size={21} />
                </span>
                <span className="profile-action-row__label">
                  Cambiar contraseña
                </span>
                <ProfileIconChevronRight
                  className="profile-action-row__chevron"
                  size={18}
                />
              </button>
              <button
                type="button"
                className="profile-action-row profile-action-row--danger"
                onClick={handleLogout}
              >
                <span className="profile-action-row__icon" aria-hidden>
                  <ProfileIconLogout size={21} />
                </span>
                <span className="profile-action-row__label">Cerrar sesión</span>
                <ProfileIconChevronRight
                  className="profile-action-row__chevron"
                  size={18}
                />
              </button>
            </nav>
          </section>
          </div>

          {passwordResetSent && (
            <div className="profile-toast profile-toast--success" role="status">
              <span className="profile-toast__dot" aria-hidden />
              Te enviamos un correo con instrucciones para cambiar tu contraseña.
            </div>
          )}

          {errorMessage && (
            <div className="profile-toast profile-toast--error" role="alert">
              <span className="profile-toast__dot profile-toast__dot--err" aria-hidden />
              {errorMessage}
            </div>
          )}

          <section
            className="profile-panel profile-panel--support"
            aria-labelledby="profile-support-heading"
          >
            <div className="profile-panel__head">
              <ProfileIconSupport
                className="profile-panel__head-icon"
                size={24}
                title="Soporte"
              />
              <h2 id="profile-support-heading" className="profile-panel__title">
                Ayuda y comunidad
              </h2>
            </div>
            <p className="profile-support__intro">
              ¿Dudas con una compra o un evento? Escríbenos o síguenos.
            </p>

            <div className="profile-social-grid">
              <a
                href="https://www.instagram.com/ticketcolombia/"
                target="_blank"
                rel="noopener noreferrer"
                className="profile-social-chip"
              >
                <span className="profile-social-chip__icon" aria-hidden>
                  <ProfileIconInstagram size={22} />
                </span>
                <span className="profile-social-chip__text">Instagram</span>
              </a>
              <a
                href="https://www.tiktok.com/@ticketcolombia"
                target="_blank"
                rel="noopener noreferrer"
                className="profile-social-chip"
              >
                <span className="profile-social-chip__icon" aria-hidden>
                  <ProfileIconTikTok size={22} />
                </span>
                <span className="profile-social-chip__text">TikTok</span>
              </a>
            </div>

            <div className="profile-whatsapp-card">
              <p className="profile-whatsapp-card__title">Soporte por WhatsApp</p>
              <p className="profile-whatsapp-card__text">
                Te respondemos lo antes posible.{" "}
                <WhatsAppButton
                  message={`Hola, necesito ayuda con:\n\n[Describe tu consulta]\n\nGracias.`}
                  eventName={userData?.name || "usuario"}
                  trackingLabel="profile-contact"
                >
                  Abrir chat
                </WhatsAppButton>
              </p>
            </div>
          </section>

          <div className="bottom-nav-spacer" />
        </div>
      </main>

      <BottomNavBar />
    </div>
  );
};

export default ProfileScreen;
