import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import {
  getEventById,
  logoutUser,
  getExpensesByEventId,
  addExpense,
  deleteExpense
} from '@services';
import { getTicketsByEventId } from '@services/ticketService';
import {
  IconTickets,
  IconRevenue,
  IconUsers,
  IconChart,
  IconExpense,
  IconProfit,
  IconSection
} from '@components/EventStatsIcons';
import type { Event, EventSection } from '@services/types';
import type { Ticket } from '@services/types';
import type { Expense } from '@services/firestore';
import './index.scss';

interface SectionStats {
  sectionId: string;
  sectionName: string;
  capacity: number;
  sold: number;
  percentSold: number;
  percentRemaining: number;
  revenue: number;
}

interface Demographics {
  label: string;
  count: number;
  percent: number;
}

const EventStatsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [eventData, ticketsData, expensesData] = await Promise.all([
        getEventById(eventId),
        getTicketsByEventId(eventId),
        getExpensesByEventId(eventId)
      ]);
      setEvent(eventData || null);
      setTickets(ticketsData || []);
      setExpenses(expensesData || []);
    } catch (e) {
      setError('No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const formatCOP = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const validTickets = tickets.filter((t) => {
    const status = t.ticketStatus as string;
    const invalid = ['cancelled', 'disabled'].includes(status) || (t as { transferredTo?: string }).transferredTo;
    const valid = ['paid', 'reserved', 'used', 'redeemed'].includes(status);
    return valid && !invalid;
  });

  const totalRevenue = validTickets.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalQuantity = validTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
  const uniqueBuyers = new Set(validTickets.map((t) => t.buyerEmail || t.metadata?.userName)).size;
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;

  const sections: EventSection[] = event?.sections || [];
  const hasSections = sections.length > 0;

  const sectionStats: SectionStats[] = hasSections
    ? sections.map((sec) => {
        const sectionTickets = validTickets.filter(
          (t) => t.sectionId === sec.id || t.sectionName === sec.name
        );
        const sold = sectionTickets.reduce((s, t) => s + (t.quantity || 1), 0);
        const capacity = sec.available || 0;
        const revenue = sectionTickets.reduce((s, t) => s + (t.amount || 0), 0);
        const percentSold = capacity > 0 ? Math.min(100, (sold / capacity) * 100) : 0;
        const percentRemaining = capacity > 0 ? Math.max(0, 100 - percentSold) : 0;
        return {
          sectionId: sec.id,
          sectionName: sec.name,
          capacity,
          sold,
          percentSold,
          percentRemaining,
          revenue
        };
      })
    : [
        {
          sectionId: 'general',
          sectionName: 'General',
          capacity: event?.capacity_per_occurrence || 0,
          sold: totalQuantity,
          percentSold:
            (event?.capacity_per_occurrence || 0) > 0
              ? Math.min(100, (totalQuantity / (event?.capacity_per_occurrence || 1)) * 100)
              : 0,
          percentRemaining:
            (event?.capacity_per_occurrence || 0) > 0
              ? Math.max(0, 100 - (totalQuantity / (event?.capacity_per_occurrence || 1)) * 100)
              : 0,
          revenue: totalRevenue
        }
      ];

  const emailDomainCount: Record<string, number> = {};
  validTickets.forEach((t) => {
    const email = t.buyerEmail || '';
    const domain = email.includes('@') ? email.split('@')[1]?.toLowerCase() || 'sin_email' : 'sin_email';
    emailDomainCount[domain] = (emailDomainCount[domain] || 0) + (t.quantity || 1);
  });
  const demographics: Demographics[] = Object.entries(emailDomainCount)
    .map(([label, count]) => ({
      label: label === 'sin_email' ? 'Sin email' : label,
      count,
      percent: totalQuantity > 0 ? (count / totalQuantity) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount);
    if (!eventId || !newDesc.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await addExpense({
        description: newDesc.trim(),
        amount,
        date: new Date().toISOString().split('T')[0],
        category: newCategory.trim() || undefined,
        eventId
      });
      setNewDesc('');
      setNewAmount('');
      setNewCategory('');
      setShowAddExpense(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar este egreso?')) return;
    await deleteExpense(id);
    await loadData();
  };

  if (loading) {
    return (
      <div className="event-stats-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="event-stats-content">
          <div className="event-stats-loading">
            <div className="loading-spinner" />
            <p>Cargando estadísticas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="event-stats-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="event-stats-content">
          <p>{error || 'Evento no encontrado'}</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Volver</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="event-stats-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <div className="event-stats-content">
        <div className="event-stats-hero">
          <h1 className="event-stats-hero__title">{event.name}</h1>
          <p className="event-stats-hero__subtitle">Estadísticas y balance del evento</p>
          <SecondaryButton onClick={() => navigate('/dashboard')} className="event-stats-back">
            ← Volver al dashboard
          </SecondaryButton>
        </div>

        <div className="stats-kpi-grid">
          <div className="stat-kpi-card stat-kpi--tickets">
            <div className="stat-kpi-icon">
              <IconTickets />
            </div>
            <div className="stat-kpi-content">
              <span className="stat-kpi-value">{totalQuantity}</span>
              <span className="stat-kpi-label">Boletas vendidas</span>
            </div>
          </div>
          <div className="stat-kpi-card stat-kpi--revenue">
            <div className="stat-kpi-icon">
              <IconRevenue />
            </div>
            <div className="stat-kpi-content">
              <span className="stat-kpi-value">{formatCOP(totalRevenue)}</span>
              <span className="stat-kpi-label">Ingresos</span>
            </div>
          </div>
          <div className="stat-kpi-card stat-kpi--users">
            <div className="stat-kpi-icon">
              <IconUsers />
            </div>
            <div className="stat-kpi-content">
              <span className="stat-kpi-value">{uniqueBuyers}</span>
              <span className="stat-kpi-label">Compradores</span>
            </div>
          </div>
        </div>

        <div className="event-stats-balance">
          <div className="balance-header">
            <div className="balance-title">
              <IconProfit className="balance-title-icon" />
              <h3>Balance y utilidad</h3>
            </div>
            {!showAddExpense ? (
              <PrimaryButton onClick={() => setShowAddExpense(true)} size="small">
                + Agregar egreso
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={() => setShowAddExpense(false)} size="small">
                Cancelar
              </SecondaryButton>
            )}
          </div>

          {showAddExpense && (
            <form onSubmit={handleAddExpense} className="balance-expense-form">
              <CustomInput
                label="Descripción"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Ej: Alquiler local, publicidad..."
                required
              />
              <CustomInput
                type="number"
                label="Monto (COP)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
                required
              />
              <CustomInput
                label="Categoría (opcional)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Operación, Marketing..."
              />
              <PrimaryButton type="submit" disabled={saving} loading={saving}>
                Guardar egreso
              </PrimaryButton>
            </form>
          )}

          <div className="balance-summary">
            <div className="balance-row balance-row--income">
              <IconRevenue className="balance-row-icon" />
              <span className="balance-row-label">Ingresos</span>
              <span className="balance-row-value">{formatCOP(totalRevenue)}</span>
            </div>
            <div className="balance-row balance-row--expense">
              <IconExpense className="balance-row-icon" />
              <span className="balance-row-label">Egresos</span>
              <span className="balance-row-value">−{formatCOP(totalExpenses)}</span>
            </div>
            {expenses.length > 0 && (
              <div className="balance-expenses-list">
                {expenses.map((exp) => (
                  <div key={exp.id} className="balance-expense-item">
                    <span>{exp.description}</span>
                    <span className="balance-expense-amount">{formatCOP(exp.amount)}</span>
                    <button
                      type="button"
                      className="balance-expense-delete"
                      onClick={() => handleDeleteExpense(exp.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={`balance-row balance-row--profit ${profit >= 0 ? 'positive' : 'negative'}`}>
              <IconProfit className="balance-row-icon" />
              <span className="balance-row-label">Utilidad real</span>
              <span className="balance-row-value">{formatCOP(profit)}</span>
            </div>
          </div>
        </div>

        <div className="stats-section stats-section--sections">
          <div className="section-header-title">
            <IconSection className="section-header-icon" />
            <h3>Ventas por tribuna / sección</h3>
          </div>
          <div className="section-stats-list">
            {sectionStats.map((sec) => (
              <div key={sec.sectionId} className="section-stat-item">
                <div className="section-header">
                  <span className="section-name">{sec.sectionName}</span>
                  <span className="section-sold">
                    {sec.sold} / {sec.capacity || '∞'} vendidas
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${sec.percentSold}%` }}
                  />
                </div>
                <div className="section-footer">
                  <span className="percent-remaining">
                    {sec.percentRemaining.toFixed(0)}% por vender
                  </span>
                  <span className="section-revenue">{formatCOP(sec.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section stats-section--demographics">
          <div className="section-header-title">
            <IconChart className="section-header-icon" />
            <h3>Compradores por dominio de email</h3>
          </div>
          <div className="demographics-list">
            {demographics.length === 0 ? (
              <p className="empty">Sin datos de compradores</p>
            ) : (
              demographics.map((d) => (
                <div key={d.label} className="demographic-item">
                  <span className="demographic-label">{d.label}</span>
                  <span className="demographic-count">{d.count} boletas</span>
                  <span className="demographic-percent">{d.percent.toFixed(1)}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventStatsScreen;
