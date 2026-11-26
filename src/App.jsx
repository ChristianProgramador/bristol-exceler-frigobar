import React, { useState, useEffect } from 'react';

const STORAGE_KEY = '@bristol_exceler_frigobar_persist_v1';
const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/13V7DF2QivavVcFc_Ydhh3wcRC-1ISMGyWswx6NmUDCE/edit?usp=drivesdk';
const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbx8r4Yai7JVJHlqRfdQfPHVlBMMeJ6NB7rIRTYcDQq0W6hrrgp0kpTyc-mcoyMKl9c/exec';

const INITIAL_ROOMS = [
  {
    id: 101,
    number: 'Quarto 101',
    items: [
      {
        id: 'agua',
        name: 'Água 500ml',
        stock: 24,
        cart: 0,
        expectedFridge: 4,
        physicalFridge: 4,
        consumo: 0,
        avaria: 0,
        extravio: 0,
        price: 6.0,
      },
      {
        id: 'refri',
        name: 'Refrigerante Lata',
        stock: 18,
        cart: 0,
        expectedFridge: 3,
        physicalFridge: 3,
        consumo: 0,
        avaria: 0,
        extravio: 0,
        price: 8.0,
      },
      {
        id: 'cerveja',
        name: 'Cerveja Long Neck',
        stock: 12,
        cart: 0,
        expectedFridge: 2,
        physicalFridge: 2,
        consumo: 0,
        avaria: 0,
        extravio: 0,
        price: 12.0,
      },
      {
        id: 'chocolate',
        name: 'Chocolate Barra',
        stock: 15,
        cart: 0,
        expectedFridge: 2,
        physicalFridge: 1,
        consumo: 1,
        avaria: 0,
        extravio: 0,
        price: 10.0,
      },
    ],
  },
];

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('Erro ao ler dados salvos:', err);
    return null;
  }
}

export default function App() {
  const savedState = loadSavedState();

  const [rooms, setRooms] = useState(() => savedState?.rooms || INITIAL_ROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState(
    () => savedState?.selectedRoomId || (savedState?.rooms?.[0]?.id ?? INITIAL_ROOMS[0].id)
  );
  const [activeTab, setActiveTab] = useState('auditoria');
  const [notification, setNotification] = useState('');

  // Novo quarto
  const [newRoomNumber, setNewRoomNumber] = useState('');

  // Novo item
  const [newItemName, setNewItemName] = useState('');
  const [newItemStock, setNewItemStock] = useState('');
  const [newItemExpectedFridge, setNewItemExpectedFridge] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rooms,
          selectedRoomId,
        })
      );
    } catch (err) {
      console.error('Erro ao salvar no localStorage:', err);
    }
  }, [rooms, selectedRoomId]);

  const currentRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  // Estoque <-> Carrinho (Subida)
  const handleMoveToCart = (itemId, delta) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== currentRoom.id) return room;
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id !== itemId) return item;
            if (delta > 0 && item.stock <= 0) return item;
            if (delta < 0 && item.cart <= 0) return item;
            return {
              ...item,
              stock: item.stock - delta,
              cart: item.cart + delta,
            };
          }),
        };
      })
    );
  };

  // Carrinho -> Frigobar
  const handleLoadCartToFridge = (itemId) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== currentRoom.id) return room;
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id !== itemId || item.cart <= 0) return item;
            const added = item.cart;
            return {
              ...item,
              cart: 0,
              expectedFridge: item.expectedFridge + added,
              physicalFridge: item.physicalFridge + added,
            };
          }),
        };
      })
    );
    notify(`Itens do carrinho lançados no frigobar do ${currentRoom.number}!`);
  };

  // Ajuste físico no frigobar
  const handlePhysicalFridgeChange = (itemId, delta) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== currentRoom.id) return room;
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              physicalFridge: Math.max(0, (Number(item.physicalFridge) || 0) + delta),
            };
          }),
        };
      })
    );
  };

  // Ao distribuir em Consumo, Avaria ou Extravio, abate do Físico do frigobar
  const handleReasonChange = (itemId, field, delta) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== currentRoom.id) return room;
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id !== itemId) return item;

            const currentVal = Number(item[field]) || 0;
            const currentPhysical = Number(item.physicalFridge) || 0;
            const expected = Number(item.expectedFridge) || 0;

            if (delta > 0) {
              if (currentPhysical <= 0) return item;
              return {
                ...item,
                physicalFridge: currentPhysical - 1,
                [field]: currentVal + 1,
              };
            }

            if (delta < 0) {
              if (currentVal <= 0) return item;
              return {
                ...item,
                physicalFridge: Math.min(expected, currentPhysical + 1),
                [field]: currentVal - 1,
              };
            }

            return item;
          }),
        };
      })
    );
  };

  const totals = currentRoom
    ? currentRoom.items.reduce(
        (acc, item) => {
          acc.consumo += (Number(item.consumo) || 0) * (Number(item.price) || 0);
          acc.avaria += (Number(item.avaria) || 0) * (Number(item.price) || 0);
          acc.extravio += (Number(item.extravio) || 0) * (Number(item.price) || 0);
          return acc;
        },
        { consumo: 0, avaria: 0, extravio: 0 }
      )
    : { consumo: 0, avaria: 0, extravio: 0 };

  const handleSaveAudit = async (e) => {
    e.preventDefault();
    if (!currentRoom) return;

    const payload = currentRoom.items.map((item) => {
      const expected = Number(item.expectedFridge) || 0;
      const physical = Number(item.physicalFridge) || 0;
      const consumo = Number(item.consumo) || 0;
      const avaria = Number(item.avaria) || 0;
      const extravio = Number(item.extravio) || 0;
      const price = Number(item.price) || 0;

      return {
        Quarto: currentRoom.number,
        Item: item.name,
        Estoque: Number(item.stock) || 0,
        Carrinho: Number(item.cart) || 0,
        Esperado_Frigobar: expected,
        Fisico_Frigobar: physical,
        Consumo_Qtd: consumo,
        Consumo_Valor: Number((consumo * price).toFixed(2)),
        Avaria_Qtd: avaria,
        Avaria_Valor: Number((avaria * price).toFixed(2)),
        Extravio_Qtd: extravio,
        Extravio_Valor: Number((extravio * price).toFixed(2)),
        Preco_Unitario: price,
        Data_Hora: new Date().toLocaleString('pt-BR'),
      };
    });

    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== currentRoom.id) return room;
          return {
            ...room,
            items: room.items.map((item) => ({
              ...item,
              expectedFridge: Number(item.physicalFridge) || 0,
              consumo: 0,
              avaria: 0,
              extravio: 0,
            })),
          };
        })
      );

      notify(`Auditoria do ${currentRoom.number} salva e enviada para a planilha!`);
    } catch (error) {
      console.error('Erro ao salvar auditoria:', error);
      alert('Erro ao enviar para a planilha.');
    }
  };

  const handleAddRoom = (e) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) return;

    const created = {
      id: Date.now(),
      number: newRoomNumber.trim(),
      items: [
        {
          id: `agua-${Date.now()}`,
          name: 'Água 500ml',
          stock: 20,
          cart: 0,
          expectedFridge: 4,
          physicalFridge: 4,
          consumo: 0,
          avaria: 0,
          extravio: 0,
          price: 6.0,
        },
        {
          id: `refri-${Date.now() + 1}`,
          name: 'Refrigerante Lata',
          stock: 15,
          cart: 0,
          expectedFridge: 3,
          physicalFridge: 3,
          consumo: 0,
          avaria: 0,
          extravio: 0,
          price: 8.0,
        },
      ],
    };

    setRooms((prev) => [...prev, created]);
    setSelectedRoomId(created.id);
    setNewRoomNumber('');
    notify(`${created.number} cadastrado!`);
  };

  const handleDeleteRoom = (roomId) => {
    if (rooms.length === 1) {
      alert('Mantenha ao menos um quarto cadastrado.');
      return;
    }
    const remaining = rooms.filter((r) => r.id !== roomId);
    setRooms(remaining);
    setSelectedRoomId(remaining[0].id);
    notify('Quarto removido.');
  };

  const handleAddItemToRoom = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemExpectedFridge || !newItemPrice) return;

    const initialStock = newItemStock !== '' ? Math.max(0, Number(newItemStock)) : 0;
    const expectedFridge = Math.max(0, Number(newItemExpectedFridge));

    const newItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      stock: initialStock,
      cart: 0,
      expectedFridge,
      physicalFridge: expectedFridge,
      consumo: 0,
      avaria: 0,
      extravio: 0,
      price: Number(newItemPrice),
    };

    setRooms((prev) =>
      prev.map((room) =>
        room.id === currentRoom.id ? { ...room, items: [...room.items, newItem] } : room
      )
    );

    setNewItemName('');
    setNewItemStock('');
    setNewItemExpectedFridge('');
    setNewItemPrice('');
    notify(`Produto "${newItem.name}" adicionado ao ${currentRoom.number}!`);
  };

  const handleDeleteItem = (itemId) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === currentRoom.id
          ? { ...room, items: room.items.filter((i) => i.id !== itemId) }
          : room
      )
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-slate-900 text-white shadow-md p-4 flex flex-col md:flex-row justify-between items-center gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight">
            🏨 Bristol Exceler Plaza Hotel — Controle Gerencial de Frigobar
          </h1>
          <p className="text-xs text-slate-400">
            Estoque → Carrinho (Subida) → Frigobar | Classificação por Produto: Consumo, Avaria e Extravio
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('auditoria')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'auditoria'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            📊 Estoque, Carrinho & Frigobar
          </button>
          <button
            onClick={() => setActiveTab('cadastros')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'cadastros'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ⚙️ Quartos & Produtos
          </button>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition"
          >
            📄 Abrir Planilha
          </a>
        </div>
      </header>

      {notification && (
        <div className="max-w-lg mx-auto mt-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow text-center text-sm font-medium">
          {notification}
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {activeTab === 'auditoria' && currentRoom && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-md p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Conferência — {currentRoom.number}
                </h2>
                <p className="text-sm text-slate-500">
                  Cada produto possui controle individual de Consumo, Avaria e Extravio.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-emerald-700 font-semibold">Consumo: </span>
                  <span className="font-bold text-emerald-900">R$ {totals.consumo.toFixed(2)}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-amber-700 font-semibold">Avaria: </span>
                  <span className="font-bold text-amber-900">R$ {totals.avaria.toFixed(2)}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-rose-700 font-semibold">Extravio: </span>
                  <span className="font-bold text-rose-900">R$ {totals.extravio.toFixed(2)}</span>
                </div>

                <select
                  value={currentRoom.id}
                  onChange={(e) => setSelectedRoomId(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.number}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSaveAudit} className="bg-white rounded-2xl shadow-md p-5 md:p-6">
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-3 px-2">Item</th>
                      <th className="py-3 px-2 text-center">Estoque</th>
                      <th className="py-3 px-2 text-center">Carrinho</th>
                      <th className="py-3 px-2 text-center">Frigobar (Esp/Fís)</th>
                      <th className="py-3 px-2 text-center text-emerald-700">Consumo</th>
                      <th className="py-3 px-2 text-center text-amber-700">Avaria</th>
                      <th className="py-3 px-2 text-center text-rose-700">Extravio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentRoom.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 align-middle">
                        <td className="py-3 px-2">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500">R$ {item.price.toFixed(2)}</div>
                        </td>

                        <td className="py-3 px-2 text-center font-bold text-slate-800">
                          {item.stock}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveToCart(item.id, -1)}
                              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 font-bold text-amber-700">{item.cart}</span>
                            <button
                              type="button"
                              onClick={() => handleMoveToCart(item.id, 1)}
                              className="w-6 h-6 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold"
                            >
                              +
                            </button>
                            {item.cart > 0 && (
                              <button
                                type="button"
                                onClick={() => handleLoadCartToFridge(item.id)}
                                className="ml-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                              >
                                Subir
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">{item.expectedFridge} /</span>
                            <button
                              type="button"
                              onClick={() => handlePhysicalFridgeChange(item.id, -1)}
                              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 font-bold text-slate-900">
                              {item.physicalFridge}
                            </span>
                            <button
                              type="button"
                              onClick={() => handlePhysicalFridgeChange(item.id, 1)}
                              className="w-6 h-6 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleReasonChange(item.id, 'consumo', -1)}
                              className="w-6 h-6 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 font-bold text-emerald-800">{item.consumo}</span>
                            <button
                              type="button"
                              onClick={() => handleReasonChange(item.id, 'consumo', 1)}
                              className="w-6 h-6 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleReasonChange(item.id, 'avaria', -1)}
                              className="w-6 h-6 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 font-bold text-amber-800">{item.avaria}</span>
                            <button
                              type="button"
                              onClick={() => handleReasonChange(item.id, 'avaria', 1)}
                              className="w-6 h-6 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleReasonChange(item.id, 'extravio', -1)}
                              className="w-6 h-6 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 font-bold text-rose-800">{item.extravio}</span>
                            <button
                              type="button"
                              onClick={() => handleReasonChange(item.id, 'extravio', 1)}
                              className="w-6 h-6 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow transition"
              >
                💾 Salvar Conferência e Atualizar {currentRoom.number}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'cadastros' && currentRoom && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">➕ Cadastrar Novo Quarto</h2>
              <form onSubmit={handleAddRoom} className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Ex: Quarto 202"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition"
                >
                  Adicionar Quarto
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    📦 Produtos do {currentRoom.number}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Defina estoque inicial, quantidade padrão do frigobar e preço unitário.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteRoom(currentRoom.id)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold px-4 py-2 rounded-xl text-sm transition"
                >
                  🗑️ Excluir {currentRoom.number}
                </button>
              </div>

              <div className="space-y-2 mb-6">
                {currentRoom.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <span className="text-slate-500 ml-2">
                        (Estoque: {item.stock} | Frigobar: {item.expectedFridge} | R$ {item.price.toFixed(2)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-rose-600 hover:text-rose-800 font-bold text-xs bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddItemToRoom} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="Nome do item"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Estoque inicial"
                  value={newItemStock}
                  onChange={(e) => setNewItemStock(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Qtd Frigobar"
                  value={newItemExpectedFridge}
                  onChange={(e) => setNewItemExpectedFridge(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Preço R$"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-sm transition"
                >
                  + Adicionar Item
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}