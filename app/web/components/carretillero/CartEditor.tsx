/**
 * CartEditor — Editor de carros manuales
 * Gestor de Estanterías WMS v3.0
 * 
 * Entrada de texto libre para describir contenido de carros.
 * Solo editable por CARRETILLERO, ADMIN, SUPERADMIN.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebaseV3';
import { COLLECTIONS, CART_DEFINITIONS } from '../../lib/firestoreSchema';
import { useAuth } from '../../hooks/useAuth';
import { saveCartLocation } from '../../lib/cartApi';

const CartEditor: React.FC = () => {
  const { canEditCarts } = useAuth();
  const [selectedCart, setSelectedCart] = useState(CART_DEFINITIONS[0]?.code || '');
  const [items, setItems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load cart data
  useEffect(() => {
    if (!selectedCart) return;
    setLoading(true);

    const loadCart = async () => {
      try {
        const cartDef = CART_DEFINITIONS.find(c => c.code === selectedCart);
        if (!cartDef) return;

        const newItems: Record<string, string> = {};
        for (let i = 1; i <= cartDef.locationCount; i++) {
          const pos = i.toString().padStart(3, '0');
          const locRef = doc(db, COLLECTIONS.SHELVES, selectedCart, COLLECTIONS.LOCATIONS, pos);
          const locSnap = await getDoc(locRef);
          if (locSnap.exists()) {
            const data = locSnap.data();
            // Cart items use description field
            const cartItems = data.items || [];
            newItems[pos] = cartItems.map((item: any) => item.articleCode || item.description || '').join(', ');
          } else {
            newItems[pos] = '';
          }
        }
        setItems(newItems);
      } catch (err) {
        console.error('[CartEditor] Load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [selectedCart]);

  const handleSave = useCallback(async (position: string, description: string) => {
    if (!canEditCarts) return;
    setSaving(true);

    try {
      await saveCartLocation(selectedCart, position, description);

      setItems(prev => ({ ...prev, [position]: description }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[CartEditor] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedCart, canEditCarts]);

  const cartDef = CART_DEFINITIONS.find(c => c.code === selectedCart);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-black text-white flex items-center gap-2">
        🛒 Carros Manuales
      </h2>

      {/* Cart selector */}
      <div className="flex gap-2">
        {CART_DEFINITIONS.map(cart => (
          <button
            key={cart.code}
            onClick={() => setSelectedCart(cart.code)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors
              ${selectedCart === cart.code
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
          >
            {cart.name}
          </button>
        ))}
      </div>

      {/* Saved indicator */}
      {saved && (
        <div className="text-center text-sm font-bold text-emerald-400 animate-pulse">
          ✅ Guardado
        </div>
      )}

      {/* Cart positions */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {cartDef && Array.from({ length: cartDef.locationCount }, (_, i) => {
            const pos = (i + 1).toString().padStart(3, '0');
            return (
              <div key={pos} className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 w-8">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={items[pos] || ''}
                    onChange={(e) => setItems(prev => ({ ...prev, [pos]: e.target.value }))}
                    onBlur={(e) => handleSave(pos, e.target.value)}
                    disabled={!canEditCarts || saving}
                    placeholder={canEditCarts ? 'Describir contenido...' : 'Sin contenido'}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 
                      text-sm text-white placeholder-slate-600 
                      focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canEditCarts && (
        <p className="text-center text-xs text-slate-600">
          Solo el carretillero y administradores pueden editar los carros.
        </p>
      )}
    </div>
  );
};

export default CartEditor;
