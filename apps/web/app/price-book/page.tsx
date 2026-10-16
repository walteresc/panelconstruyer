"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@ofp/shared";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number; // cents
  category: string;
}

const CATEGORIES = ["Gasfitería", "Electricidad", "Pintura", "Drywall", "Albañilería", "Impermeabilización", "Pisos", "Remodelación", "General", "Otro"];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = "ofp_services";

function loadServices(): Service[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Service[]) : [];
  } catch {
    return [];
  }
}

function saveServices(services: Service[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
}

export default function PriceBookPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "General" });

  useEffect(() => {
    setServices(loadServices());
    setMounted(true);
  }, []);

  const persist = (updated: Service[]) => {
    setServices(updated);
    saveServices(updated);
  };

  const filtered = useMemo(() => {
    let list = [...services];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      list = list.filter((s) => s.category === categoryFilter);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [services, search, categoryFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: "", category: "General" });
    setShowForm(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description,
      price: String(s.price),
      category: s.category,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    const priceCents = Math.round(parseFloat(form.price || "0") * 100);
    if (!form.name.trim() || priceCents <= 0) return;

    if (editing) {
      persist(
        services.map((s) =>
          s.id === editing.id
            ? { ...s, name: form.name.trim(), description: form.description.trim(), price: priceCents, category: form.category }
            : s
        )
      );
    } else {
      persist([
        ...services,
        {
          id: uid(),
          name: form.name.trim(),
          description: form.description.trim(),
          price: priceCents,
          category: form.category,
        },
      ]);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    persist(services.filter((s) => s.id !== id));
  };

  if (!mounted) {
    return (
      <div>
        <PageHeader title="Lista de precios" description="Cargando..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Lista de precios"
        description={`${services.length} servicio${services.length !== 1 ? "s" : ""} en ${CATEGORIES.filter((c) => services.some((s) => s.category === c)).length} categorías`}
        actions={
          <Button onClick={openNew} size="sm">
            ⊕ Agregar servicio
          </Button>
        }
      />

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          type="search"
          placeholder="Buscar servicios..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs flex-1"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Card className="mb-4 border-accent/30">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-fg mb-3">
              {editing ? "Editar servicio" : "Nuevo servicio"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Input
                placeholder="Nombre del servicio"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              <Input
                placeholder="Precio (S/)"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Input
                placeholder="Descripción (opcional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="h-10 rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name.trim() || !form.price}>
                {editing ? "Guardar cambios" : "Agregar servicio"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services list */}
      {services.length === 0 ? (
        <Card>
          <EmptyState
            title="Aún no hay servicios"
            description="Agrega tu primer servicio para armar tu lista de precios."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-sm text-fg-muted">Ningún servicio coincide con los filtros</p>
            <button
              onClick={() => { setSearch(""); setCategoryFilter("all"); }}
              className="text-xs text-fg-link hover:text-fg mt-1 cursor-pointer bg-transparent border-none"
            >
              Limpiar filtros
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">{s.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-fg tabular-nums shrink-0">
                    {formatMoney(s.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-300 text-fg-muted">
                    {s.category}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-xs px-2 py-1 rounded bg-surface-300 text-fg-muted hover:text-fg hover:bg-surface-400 transition-colors cursor-pointer border-none"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs px-2 py-1 rounded bg-surface-300 text-red hover:bg-red/10 transition-colors cursor-pointer border-none"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
