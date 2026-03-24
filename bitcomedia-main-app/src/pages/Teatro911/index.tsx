import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./index.scss";
import Loader from "../../components/Loader";
import EventCard from "../../containers/EventCard";
import BottomNavBar from "../../containers/BottomNavBar";
import TopNavBar from "../../containers/TopNavBar";
import WhatsAppButton from "../../components/WhatsAppButton";
import { getCurrentUser } from "../../services";
import {
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../services/firestore";
import heroBannerImage from "../../assets/teatro911/hero-banner.png";
import teatro911Logo from "../../assets/teatro911/911_logo.png";

// Event data interface
interface EventData {
  id: string;
  slug?: string;
  name: string;
  description: string;
  city: string;
  venue: {
    name: string;
    address: string;
  };
  cover_image_url: string;
  date: string;
  time: string;
  event_date: Timestamp;
  ticket_price: number;
  status?: string;
  recurrence_pattern?: string;
  is_recurring?: boolean;
}

const Teatro911Screen: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const EVENTS_PER_PAGE = 10;

  const navigate = useNavigate();

  // Reference for the last event element for infinite scrolling
  const lastEventElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || loadingMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreEvents();
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, hasMore]
  );

  useEffect(() => {
    // Check if user is logged in
    const user = getCurrentUser();
    setIsAuthenticated(!!user);

    // Fetch events
    fetchEvents(true);
  }, []);

  const createEventsQuery = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventsRef = collection(db, "events");

    // All upcoming events for Teatro 911
    const eventsQuery = query(
      eventsRef,
      where("status", "==", "active"),
      where("venue.name", "==", "Teatro 911"),
      where("event_date", ">=", Timestamp.fromDate(today)),
      orderBy("event_date", "asc")
    );

    return eventsQuery;
  };

  const fetchEvents = async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) {
      setLoading(true);
      setLastVisible(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const baseQuery = createEventsQuery();

      // Apply pagination
      let paginatedQuery;
      if (lastVisible && !isInitialLoad) {
        paginatedQuery = query(
          baseQuery,
          startAfter(lastVisible),
          limit(EVENTS_PER_PAGE)
        );
      } else {
        paginatedQuery = query(baseQuery, limit(EVENTS_PER_PAGE));
      }

      const querySnapshot = await getDocs(paginatedQuery);
      const eventsData: EventData[] = [];

      // Check if there are any results
      if (querySnapshot.empty) {
        setHasMore(false);
        if (isInitialLoad) setEvents([]);
        return;
      }

      // Process results
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<EventData, "id">;
        eventsData.push({
          id: doc.id,
          ...data,
        });
      });

      // Set last visible document for pagination
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);

      // Check if this is initial load or loading more
      if (isInitialLoad) {
        setEvents(eventsData);
      } else {
        setEvents((prev) => [...prev, ...eventsData]);
      }

      // Check if there are more results
      setHasMore(querySnapshot.docs.length === EVENTS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreEvents = () => {
    if (!loadingMore && hasMore) {
      fetchEvents(false);
    }
  };

  const navigateToEvent = (identifier: string, sourceEvent?: EventData) => {
    if (sourceEvent) {
      navigate(`/evento/${identifier}`, {
        state: { eventFromList: sourceEvent },
      });
    } else {
      navigate(`/evento/${identifier}`);
    }
  };

  return (
    <div className="teatro911-screen teatro911-theme">
      {/* Add TopNavBar for medium and large screens */}
      <TopNavBar isAuthenticated={isAuthenticated} theme="teatro911" />

      {/* Hero Banner Section - Image Only */}
      <div className="teatro911-hero-banner">
        <img
          src={heroBannerImage}
          alt="STANDUP EN EL 911 - Entretenimiento en estado de emergencia"
          className="teatro911-hero-image"
        />
      </div>

      {/* Header Content Section */}
      <div className="teatro911-header">
        <div className="teatro911-header-content">
          <div className="teatro911-logo-container">
            <img 
              src={teatro911Logo} 
              alt="Teatro 911 Logo" 
              className="teatro911-logo"
            />
          </div>
          <div className="teatro911-text-content">
            <p className="teatro911-hero-subtitle">
              El epicentro del entretenimiento. Shows únicos, vibra familiar, humor
              sin límites.
            </p>
            <p className="teatro911-whatsapp-contact">
              Recuerda que también nos puedes contactar por{" "}
              <WhatsAppButton
                message="¡Yo! Vengo del Teatro 911 y quiero info sobre los shows más locos en la ciudad 🎭🔥"
                trackingLabel="teatro911-contact"
                theme="teatro911"
              >
                WhatsApp
              </WhatsAppButton>
            </p>
          </div>
        </div>
      </div>

      <div className="teatro911-content">
        <div className="teatro911-section">
          {loading ? (
            <div className="loading-container">
              <Loader size="large" color="accent" theme="teatro911" />
            </div>
          ) : events.length > 0 ? (
            <div className="event-grid">
              {events.map((event, index) => {
                // Add ref to last element for infinite scrolling
                if (events.length === index + 1) {
                  return (
                    <div key={event.id} ref={lastEventElementRef}>
                      <EventCard
                        event={event}
                        onReserve={(identifier, _isRecurring, src) =>
                          navigateToEvent(identifier, src)
                        }
                        theme="teatro911"
                      />
                    </div>
                  );
                } else {
                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      onReserve={(identifier, _isRecurring, src) =>
                        navigateToEvent(identifier, src)
                      }
                      theme="teatro911"
                    />
                  );
                }
              })}
              {loadingMore && (
                <div className="loading-more">
                  <Loader size="small" color="secondary" theme="teatro911" />
                </div>
              )}
            </div>
          ) : (
            <p>No hay shows disponibles en este momento. ¡Pronto más locura!</p>
          )}
        </div>
      </div>

      <footer className="teatro911-footer">
        <p>
          &copy; {new Date().getFullYear()} Teatro 911. Donde la
          risa se vuelve arte.
        </p>
      </footer>

      {/* Add BottomNavBar for mobile devices */}
      <BottomNavBar theme="teatro911" />

      {/* Add a spacer div for mobile view */}
      <div className="bottom-nav-spacer"></div>
    </div>
  );
};

export default Teatro911Screen;
