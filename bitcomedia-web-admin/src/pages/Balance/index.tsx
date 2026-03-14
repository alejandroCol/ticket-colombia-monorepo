import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import {
  getExpenses,
  addExpense,
  deleteExpense,
  getTotalRevenue,
  logoutUser
} from '@services';
import type { Expense } from '@services/firestore';
import './index.scss';

const BalanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rev, exps] = await Promise.all([getTotalRevenue(), getExpenses()]);
      setRevenue(rev);
      setExpenses(exps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = revenue - totalExpenses;

  const formatCOP = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount);
    if (!newDescription.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await addExpense({
        description: newDescription.trim(),
        amount,
        date: new Date().toISOString().split('T')[0],
        category: newCategory.trim() || undefined
      });
      setNewDescription('');
      setNewAmount('');
      setNewCategory('');
      setShowAddForm(false);
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
      <div className="balance-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="balance-content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="balance-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <div className="balance-content">
        <div className="balance-header">
          <h1>💰 Balance y ganancias</h1>
          <SecondaryButton onClick={() => navigate('/dashboard')}>
            ← Volver
          </SecondaryButton>
        </div>

        <div className="balance-cards">
          <div className="balance-card income">
            <span className="balance-label">Ingresos totales</span>
            <span className="balance-value">{formatCOP(revenue)}</span>
          </div>
          <div className="balance-card expense">
            <span className="balance-label">Egresos totales</span>
            <span className="balance-value">{formatCOP(totalExpenses)}</span>
          </div>
          <div className={`balance-card profit ${profit >= 0 ? 'positive' : 'negative'}`}>
            <span className="balance-label">Ganancia neta</span>
            <span className="balance-value">{formatCOP(profit)}</span>
          </div>
        </div>

        <div className="expenses-section">
          <div className="expenses-header">
            <h2>Egresos</h2>
            {!showAddForm ? (
              <PrimaryButton onClick={() => setShowAddForm(true)}>
                + Agregar egreso
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={() => setShowAddForm(false)}>
                Cancelar
              </SecondaryButton>
            )}
          </div>

          {showAddForm && (
            <form onSubmit={handleAddExpense} className="expense-form">
              <CustomInput
                label="Descripción"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
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
                placeholder="Ej: Operación, Marketing"
              />
              <PrimaryButton type="submit" disabled={saving} loading={saving}>
                Guardar egreso
              </PrimaryButton>
            </form>
          )}

          <div className="expenses-list">
            {expenses.length === 0 ? (
              <p className="empty">No hay egresos registrados</p>
            ) : (
              expenses.map((exp) => (
                <div key={exp.id} className="expense-item">
                  <div className="expense-info">
                    <span className="expense-desc">{exp.description}</span>
                    {exp.category && (
                      <span className="expense-cat">{exp.category}</span>
                    )}
                  </div>
                  <div className="expense-amount">{formatCOP(exp.amount)}</div>
                  <button
                    type="button"
                    className="expense-delete"
                    onClick={() => handleDeleteExpense(exp.id)}
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceScreen;
