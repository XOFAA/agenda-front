import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, API_URL } from './lib/api';
import { nowIsoDate, toDateTime, toMoney } from './lib/formatters';

const SESSION_KEY = 'agenda_front_session';
const DEFAULT_SEARCH = {
  esporte: '',
  data: '',
  horario: 'QUALQUER',
  cidade: '',
  termo: '',
};
const FEATURED_IMAGES = [
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542144582-1ba00456b5e3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1611251135345-18c56206b863?auto=format&fit=crop&w=900&q=80',
];

function mapSportLabel(sport) {
  switch (sport) {
    case 'FUTEBOL':
      return 'Futebol';
    case 'VOLEI':
      return 'Volei';
    case 'TENIS':
      return 'Tenis';
    case 'BASQUETE':
      return 'Basquete';
    default:
      return 'Esporte';
  }
}

function matchTimePeriod(isoDate, period) {
  if (!period || period === 'QUALQUER') return true;
  const hour = new Date(isoDate).getHours();
  if (period === 'MANHA') return hour >= 8 && hour < 12;
  if (period === 'TARDE') return hour >= 14 && hour < 18;
  if (period === 'NOITE') return hour >= 18 && hour < 22;
  return true;
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSessionStorage(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function App() {
  const [session, setSession] = useState(() => getSession());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantCourts, setTenantCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [championships, setChampionships] = useState([]);
  const [featuredChampionships, setFeaturedChampionships] = useState([]);
  const [selectedChampionship, setSelectedChampionship] = useState(null);
  const [myBookings, setMyBookings] = useState([]);

  const [search, setSearch] = useState(DEFAULT_SEARCH);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [activeDayOffset, setActiveDayOffset] = useState(0);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [arenaAvailability, setArenaAvailability] = useState({});
  const [sortBy, setSortBy] = useState('relevantes');
  const [showAuth, setShowAuth] = useState(false);
  const [authForm, setAuthForm] = useState({ mode: 'entrar', nome: '', email: '', senha: '' });
  const [reviewForm, setReviewForm] = useState({ nota: 5, comentario: '' });

  const token = session?.accessToken || '';
  const user = session?.usuario || null;
  const isUser = user?.papel === 'USUARIO';
  const isDetailPage = currentPage === 'detail';
  const isChampionshipPage = currentPage === 'championship';
  const isHomePage = currentPage === 'home';

  const request = useCallback(
    async (path, options = {}) => {
      try {
        setError('');
        return await apiRequest(path, { token, ...options });
      } catch (err) {
        setError(`${err.message} (${err.code})`);
        throw err;
      }
    },
    [token],
  );

  const run = useCallback(async (fn) => {
    setLoading(true);
    try {
      await fn();
    } catch {
      // request() já define mensagem de erro; evita quebrar a tela com promise rejeitada.
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async () => {
    const data = await request('/publico/tenants');
    setTenants(data);
    if (!selectedTenantId && data.length) {
      setSelectedTenantId(data[0].id);
    }
  }, [request, selectedTenantId]);

  const loadTenantData = useCallback(async () => {
    if (!selectedTenantId) return;

    const [tenantData, courtsData, reviewsData, championshipsData] = await Promise.all([
      request(`/publico/tenants/${selectedTenantId}`),
      request(`/publico/tenants/${selectedTenantId}/quadras`),
      request(`/publico/tenants/${selectedTenantId}/avaliacoes`),
      request(`/publico/tenants/${selectedTenantId}/campeonatos`),
    ]);

    setSelectedTenant(tenantData);
    setTenantCourts(courtsData);
    setReviews(reviewsData);
    setChampionships(championshipsData);

    if (!selectedCourtId && courtsData.length) {
      setSelectedCourtId(courtsData[0].id);
    }
  }, [request, selectedTenantId, selectedCourtId]);

  const loadSlots = useCallback(async () => {
    if (!selectedTenantId || !selectedCourtId) {
      setSlots([]);
      return;
    }
    const effectiveDate = search.data || nowIsoDate();
    const data = await request(`/publico/tenants/${selectedTenantId}/quadras/${selectedCourtId}/slots`, {
      query: { data: effectiveDate },
    });
    setSlots(data);
  }, [request, search.data, selectedCourtId, selectedTenantId]);

  const loadMyBookings = useCallback(async () => {
    if (!isUser) return;
    const data = await request('/usuario/minhas-reservas');
    setMyBookings(data);
  }, [isUser, request]);

  useEffect(() => {
    run(loadTenants);
  }, [loadTenants, run]);

  useEffect(() => {
    run(loadTenantData);
  }, [loadTenantData, run]);

  useEffect(() => {
    run(loadSlots);
  }, [loadSlots, run]);

  useEffect(() => {
    run(loadMyBookings);
  }, [loadMyBookings, run]);

  const filteredTenants = useMemo(() => {
    const term = search.termo.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) => {
      const nameMatch = tenant.nome.toLowerCase().includes(term);
      const slugMatch = tenant.slug.toLowerCase().includes(term);
      return nameMatch || slugMatch;
    });
  }, [search.termo, tenants]);

  const visibleCourts = useMemo(() => {
    if (!search.esporte) return tenantCourts;
    return tenantCourts.filter((court) => court.tipoEsporte === search.esporte);
  }, [search.esporte, tenantCourts]);

  const visibleSlots = useMemo(
    () => slots.filter((slot) => matchTimePeriod(slot.inicioEm, search.horario)),
    [search.horario, slots],
  );
  const availableArenas = useMemo(
    () =>
      filteredTenants
        .filter((tenant) => arenaAvailability[tenant.id]?.totalSlots > 0)
        .map((tenant) => ({ ...tenant, availability: arenaAvailability[tenant.id] })),
    [arenaAvailability, filteredTenants],
  );
  const displayArenas = useMemo(
    () =>
      availableArenas.length > 0
        ? availableArenas
        : filteredTenants.map((tenant) => ({
            ...tenant,
            availability: arenaAvailability[tenant.id] || {
              totalSlots: 0,
              minPriceCentavos: 0,
              firstSport: 'FUTEBOL',
              mediaNotas: 0,
              totalAvaliacoes: 0,
            },
          })),
    [availableArenas, arenaAvailability, filteredTenants],
  );
  const sortedArenas = useMemo(() => {
    const list = [...displayArenas];
    if (sortBy === 'menor_preco') {
      return list.sort(
        (a, b) => (a.availability?.minPriceCentavos || 0) - (b.availability?.minPriceCentavos || 0),
      );
    }
    if (sortBy === 'maior_preco') {
      return list.sort(
        (a, b) => (b.availability?.minPriceCentavos || 0) - (a.availability?.minPriceCentavos || 0),
      );
    }
    return list.sort((a, b) => (b.availability?.totalSlots || 0) - (a.availability?.totalSlots || 0));
  }, [displayArenas, sortBy]);
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.esporte) count += 1;
    if (search.data) count += 1;
    if (search.horario && search.horario !== 'QUALQUER') count += 1;
    if (search.cidade) count += 1;
    return count;
  }, [search.cidade, search.data, search.esporte, search.horario]);
  const selectedSlots = useMemo(
    () => slots.filter((slot) => selectedSlotIds.includes(slot.id)),
    [selectedSlotIds, slots],
  );
  const subtotalSelected = useMemo(
    () => selectedSlots.reduce((acc, slot) => acc + slot.precoCentavos, 0),
    [selectedSlots],
  );
  const serviceFee = Math.round(subtotalSelected * 0.1);
  const totalSelected = subtotalSelected + serviceFee;
  const canReviewSelectedTenant = useMemo(
    () =>
      myBookings.some(
        (booking) =>
          booking.tenantId === selectedTenantId &&
          (booking.status === 'PENDENTE' || booking.status === 'CONFIRMADA'),
      ),
    [myBookings, selectedTenantId],
  );
  const dateOptions = useMemo(() => {
    const baseDate = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(baseDate);
      day.setDate(baseDate.getDate() + index);
      return {
        offset: index,
        label: day.toLocaleDateString('pt-BR', { weekday: 'short' }),
        dayNumber: day.toLocaleDateString('pt-BR', { day: '2-digit' }),
        iso: day.toISOString().slice(0, 10),
      };
    });
  }, []);

  useEffect(() => {
    if (!tenants.length) return;

    let cancelled = false;
    const checkAvailability = async () => {
      setAvailabilityLoading(true);
      const map = {};

      await Promise.all(
        filteredTenants.map(async (tenant) => {
          try {
            const [courts, tenantReviews] = await Promise.all([
              apiRequest(`/publico/tenants/${tenant.id}/quadras`),
              apiRequest(`/publico/tenants/${tenant.id}/avaliacoes`),
            ]);
            const filteredCourts = search.esporte
              ? courts.filter((court) => court.tipoEsporte === search.esporte)
              : courts;

            if (!filteredCourts.length) return;

            let totalSlots = 0;
            let minPriceCentavos = Number.MAX_SAFE_INTEGER;
            let firstSport = filteredCourts[0].tipoEsporte;

            await Promise.all(
              filteredCourts.map(async (court) => {
                const courtSlots = await apiRequest(`/publico/tenants/${tenant.id}/quadras/${court.id}/slots`, {
                  query: { data: search.data || nowIsoDate() },
                });
                const matchedSlots = courtSlots.filter((slot) =>
                  matchTimePeriod(slot.inicioEm, search.horario),
                );

                if (matchedSlots.length > 0) {
                  firstSport = court.tipoEsporte;
                }

                totalSlots += matchedSlots.length;
                for (const slot of matchedSlots) {
                  if (slot.precoCentavos < minPriceCentavos) {
                    minPriceCentavos = slot.precoCentavos;
                  }
                }
              }),
            );

            map[tenant.id] = {
              totalSlots,
              minPriceCentavos: minPriceCentavos === Number.MAX_SAFE_INTEGER ? 0 : minPriceCentavos,
              firstSport,
              mediaNotas: tenantReviews?.mediaNotas || 0,
              totalAvaliacoes: tenantReviews?.totalAvaliacoes || 0,
            };
          } catch {
            // Ignora erro pontual de tenant
          }
        }),
      );

      if (!cancelled) {
        setArenaAvailability(map);
        setAvailabilityLoading(false);
      }
    };

    checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [filteredTenants, search.data, search.esporte, search.horario, tenants.length]);

  const loadFeaturedChampionships = useCallback(async () => {
    if (!tenants.length) {
      setFeaturedChampionships([]);
      return;
    }

    const result = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          const list = await apiRequest(`/publico/tenants/${tenant.id}/campeonatos`);
          return list.map((camp) => ({
            ...camp,
            tenantId: tenant.id,
            tenantNome: tenant.nome,
            tenantImagemUrl: tenant.imagemUrl,
          }));
        } catch {
          return [];
        }
      }),
    );

    const merged = result
      .flat()
      .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())
      .slice(0, 8);
    setFeaturedChampionships(merged);
  }, [tenants]);

  useEffect(() => {
    loadFeaturedChampionships();
  }, [loadFeaturedChampionships]);

  const loginOrRegister = async (event) => {
    event.preventDefault();
    await run(async () => {
      const isRegister = authForm.mode === 'registrar';
      const path = isRegister ? '/autenticacao/registrar' : '/autenticacao/entrar';
      const body = isRegister
        ? { nome: authForm.nome, email: authForm.email, senha: authForm.senha }
        : { email: authForm.email, senha: authForm.senha };

      const result = await request(path, { method: 'POST', body, token: undefined });
      setSession(result);
      setSessionStorage(result);
      setShowAuth(false);
      await loadMyBookings();
    });
  };

  const logout = () => {
    setSession(null);
    setSessionStorage(null);
    setMyBookings([]);
    setCurrentPage('home');
  };

  const reserveSelectedSlots = async () => {
    if (!isUser) {
      setError('Faça login como USUARIO para reservar.');
      setShowAuth(true);
      return;
    }

    if (selectedSlotIds.length === 0) {
      setError('Selecione ao menos um horario.');
      return;
    }

    await run(async () => {
      await request(`/publico/tenants/${selectedTenantId}/quadras/${selectedCourtId}/reservas/lote`, {
        method: 'POST',
        body: { slotIds: selectedSlotIds },
      });
      setSelectedSlotIds([]);
      await Promise.all([loadSlots(), loadMyBookings()]);
    });
  };

  const openArenaDetail = (tenantId) => {
    setSelectedTenantId(tenantId);
    setCurrentPage('detail');
    setSelectedSlotIds([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSlotSelection = (slotId) => {
    setSelectedSlotIds((old) =>
      old.includes(slotId) ? old.filter((id) => id !== slotId) : [...old, slotId],
    );
  };

  const goToHome = () => {
    setCurrentPage('home');
    setSelectedChampionship(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToExplore = () => {
    setCurrentPage('home');
    setTimeout(() => {
      document.getElementById('explorar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  const goToMyBookings = () => {
    setCurrentPage('home');
    setTimeout(() => {
      document.getElementById('meus-agendamentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  const cancelBooking = async (reservaId) => {
    await run(async () => {
      await request(`/usuario/minhas-reservas/${reservaId}/cancelar`, { method: 'PATCH' });
      await Promise.all([loadMyBookings(), loadSlots()]);
    });
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!isUser || !selectedTenantId) return;
    await run(async () => {
      await request('/usuario/avaliacoes', {
        method: 'POST',
        body: {
          tenantId: selectedTenantId,
          nota: Number(reviewForm.nota),
          comentario: reviewForm.comentario.trim() || undefined,
        },
      });
      setReviewForm({ nota: 5, comentario: '' });
      const updated = await request(`/publico/tenants/${selectedTenantId}/avaliacoes`);
      setReviews(updated);
    });
  };

  const enrollChampionship = async (campeonatoId, tenantIdForRefresh = selectedTenantId) => {
    if (!isUser) {
      setError('Faça login como USUARIO para se inscrever no campeonato.');
      setShowAuth(true);
      return;
    }

    await run(async () => {
      await request(`/publico/campeonatos/${campeonatoId}/inscricoes`, { method: 'POST' });
      await loadFeaturedChampionships();
      if (tenantIdForRefresh) {
        const updated = await request(`/publico/tenants/${tenantIdForRefresh}/campeonatos`);
        setChampionships(updated);
      }
      if (selectedChampionship?.id === campeonatoId) {
        const detail = await request(`/publico/campeonatos/${campeonatoId}`);
        setSelectedChampionship(detail);
      }
    });
  };

  const openChampionshipDetail = async (campeonatoId) => {
    await run(async () => {
      const data = await request(`/publico/campeonatos/${campeonatoId}`);
      setSelectedChampionship(data);
      setCurrentPage('championship');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div className="arena-app">
      <header className="main-header">
        <div className="brand">
          <img src="/assets/logo.png" alt="ArenaBook" />
        </div>

        <nav>
          <button className={isHomePage ? 'active' : ''} onClick={goToHome}>Inicio</button>
          <button className={isHomePage ? 'active' : ''} onClick={goToExplore}>Explorar</button>
          <button className={isHomePage ? 'active' : ''} onClick={goToMyBookings}>Meus Agendamentos</button>
        </nav>

        <div className="auth-actions">
          {user ? (
            <>
              <span className="logged-name">{user.nome}</span>
              <button className="ghost" onClick={logout}>Sair</button>
            </>
          ) : (
            <>
              <button className="ghost" onClick={() => { setShowAuth(true); setAuthForm((old) => ({ ...old, mode: 'entrar' })); }}>
                Entrar
              </button>
              <button onClick={() => { setShowAuth(true); setAuthForm((old) => ({ ...old, mode: 'registrar' })); }}>
                Cadastrar
              </button>
            </>
          )}
        </div>
      </header>

      {!isDetailPage && !isChampionshipPage ? (
        <>
        <section className="hero-section">
          <div className="hero-overlay" />
          <div className="hero-content">
            <h1>
              Encontre a arena
              <br />
              <span>perfeita para jogar</span>
            </h1>
            <p>
              Agende quadras esportivas em segundos. Futebol, tenis, basquete e muito mais,
              tudo em um so lugar.
            </p>

            <div className="search-card">
              <div className="search-row">
                <label>
                  <small>ESPORTE</small>
                  <select
                    value={search.esporte}
                    onChange={(event) => setSearch((old) => ({ ...old, esporte: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="FUTEBOL">Futebol</option>
                    <option value="VOLEI">Volei</option>
                    <option value="TENIS">Tenis</option>
                    <option value="BASQUETE">Basquete</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </label>

                <label>
                  <small>DATA</small>
                  <input
                    type="date"
                    value={search.data}
                    onChange={(event) => setSearch((old) => ({ ...old, data: event.target.value }))}
                  />
                </label>

                <label>
                  <small>HORARIO</small>
                  <select
                    value={search.horario}
                    onChange={(event) => setSearch((old) => ({ ...old, horario: event.target.value }))}
                  >
                    <option value="QUALQUER">Qualquer horario</option>
                    <option value="MANHA">Manha (8h-12h)</option>
                    <option value="TARDE">Tarde (14h-18h)</option>
                    <option value="NOITE">Noite (18h-22h)</option>
                  </select>
                </label>

                <label>
                  <small>CIDADE</small>
                  <input
                    placeholder="Todas as cidades"
                    value={search.cidade}
                    onChange={(event) => setSearch((old) => ({ ...old, cidade: event.target.value }))}
                  />
                </label>
              </div>

              <div className="search-actions">
                <button onClick={goToExplore}>Buscar Arenas</button>
              </div>
            </div>
          </div>
        </section>

        <section className="explore-page" id="explorar">
          <div className="explore-top-search">
            <input
              placeholder="Buscar arenas por nome..."
              value={search.termo}
              onChange={(event) => setSearch((old) => ({ ...old, termo: event.target.value }))}
            />
            <button className="ghost filter-btn">
              Filtros
              <span>{activeFiltersCount}</span>
            </button>
          </div>

          <div className="explore-filters">
            <label>
              <small>ESPORTE</small>
              <select value={search.esporte} onChange={(event) => setSearch((old) => ({ ...old, esporte: event.target.value }))}>
                <option value="">Todos</option>
                <option value="FUTEBOL">Futebol</option>
                <option value="VOLEI">Volei</option>
                <option value="TENIS">Tenis</option>
                <option value="BASQUETE">Basquete</option>
                <option value="OUTROS">Outros</option>
              </select>
            </label>

            <label>
              <small>DATA</small>
              <input type="date" value={search.data} onChange={(event) => setSearch((old) => ({ ...old, data: event.target.value }))} />
            </label>

            <label>
              <small>HORARIO</small>
              <select
                value={search.horario}
                onChange={(event) => setSearch((old) => ({ ...old, horario: event.target.value }))}
              >
                <option value="QUALQUER">Qualquer</option>
                <option value="MANHA">Manha (8h-12h)</option>
                <option value="TARDE">Tarde (14h-18h)</option>
                <option value="NOITE">Noite (18h-22h)</option>
              </select>
            </label>

            <label>
              <small>CIDADE</small>
              <input
                placeholder="Todas"
                value={search.cidade}
                onChange={(event) => setSearch((old) => ({ ...old, cidade: event.target.value }))}
              />
            </label>
          </div>

          <div className="chips-row">
            {search.data ? <span className="chip">{search.data}</span> : null}
            {search.esporte ? <span className="chip">{search.esporte}</span> : null}
            {search.horario !== 'QUALQUER' ? <span className="chip">{search.horario}</span> : null}
            {search.cidade ? <span className="chip">{search.cidade}</span> : null}
            <button
              className="ghost clear-btn"
              onClick={() =>
                setSearch(DEFAULT_SEARCH)
              }
            >
              Limpar filtros
            </button>
          </div>
        </section>
        </>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      <main className="content-wrap">
        {!isDetailPage && !isChampionshipPage ? (
        <>
        <section className="featured-section">
          <header className="section-title">
            <h2>{availabilityLoading ? 'Atualizando...' : `${sortedArenas.length} arenas encontradas`}</h2>
            <div className="sort-wrap">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="relevantes">Mais relevantes</option>
                <option value="menor_preco">Menor preco</option>
                <option value="maior_preco">Maior preco</option>
              </select>
            </div>
          </header>
          <div className="featured-grid">
            {sortedArenas.map((arena) => (
              <article key={arena.id} className="featured-card">
                <div className="cover">
                  <img src={arena.imagemUrl || FEATURED_IMAGES[0]} alt={arena.nome} loading="lazy" />
                  <span className="tag">{mapSportLabel(arena.availability?.firstSport || 'FUTEBOL')}</span>
                  <span className="price">{toMoney(arena.availability?.minPriceCentavos || 0)}/h</span>
                </div>
                <div className="body">
                  <h3>{arena.nome}</h3>
                  <p>São Paulo, SP • {arena.availability?.totalSlots || 0} horarios</p>
                  <p className="card-rating">
                    ★★★★★ {arena.availability?.mediaNotas || 0} ({arena.availability?.totalAvaliacoes || 0}{' '}
                    avaliacoes)
                  </p>
                  <button className="card-cta" onClick={() => openArenaDetail(arena.id)}>Ver disponibilidade</button>
                </div>
              </article>
            ))}
            {!availabilityLoading && sortedArenas.length === 0 ? (
              <p className="empty">Nenhuma arena disponivel para os filtros atuais.</p>
            ) : null}
          </div>
        </section>

        <section className="championship-featured-section">
          <header className="section-title">
            <h2>Campeonatos em destaque</h2>
            <p>Inscreva seu time nas proximas competicoes das arenas</p>
          </header>
          <div className="championship-featured-grid">
            {featuredChampionships.map((camp) => (
              <article key={camp.id} className="championship-featured-card">
                <div className="cover">
                  <img
                    src={camp.tenantImagemUrl || FEATURED_IMAGES[0]}
                    alt={camp.nome}
                    loading="lazy"
                  />
                  <span className="tag">{mapSportLabel(camp.tipoEsporte)}</span>
                  <span className="price">{toMoney(camp.valorInscricaoCentavos)}</span>
                </div>
                <div className="body">
                  <h3>{camp.nome}</h3>
                  <div className="card-organizer">
                    <img src={camp.tenant?.logoUrl || '/assets/logo.png'} alt={`Logo ${camp.tenantNome}`} />
                    <p>{camp.tenantNome}</p>
                  </div>
                  <p>{toDateTime(camp.dataInicio)} ate {toDateTime(camp.dataFim)}</p>
                  <p>{camp._count?.inscricoes || 0}/{camp.maxParticipantes} inscritos</p>
                  <div className="actions">
                    <button className="ghost" onClick={() => openChampionshipDetail(camp.id)}>
                      Ver detalhes
                    </button>
                    <button onClick={() => enrollChampionship(camp.id, camp.tenantId)} disabled={loading}>
                      Inscrever
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {featuredChampionships.length === 0 ? (
              <p className="empty">Nenhum campeonato aberto no momento.</p>
            ) : null}
          </div>
        </section>
        </>
        ) : null}

        {isChampionshipPage ? (
          <section className="championship-page">
            <div className="detail-back">
              <button className="ghost" onClick={goToHome}>← Voltar para campeonatos</button>
            </div>

            <div
              className="championship-hero"
              style={{ backgroundImage: `url('${selectedChampionship?.tenant?.imagemUrl || FEATURED_IMAGES[0]}')` }}
            >
              <div className="detail-hero-overlay" />
              <div className="detail-hero-content">
                <span className="detail-sport-pill">{mapSportLabel(selectedChampionship?.tipoEsporte)}</span>
                <h2>{selectedChampionship?.nome || 'Campeonato'}</h2>
                <p>{selectedChampionship?.tenant?.nome}</p>
              </div>
            </div>

            <div className="championship-main-grid">
              <article className="detail-card">
                <h3>Sobre o campeonato</h3>
                <p>{selectedChampionship?.descricao || 'Campeonato com vagas limitadas e arbitragem profissional.'}</p>
                <div className="feature-chips">
                  <span>Inscricao online</span>
                  <span>Vagas limitadas</span>
                  <span>Suporte do organizador</span>
                </div>
              </article>

              <article className="summary-card">
                <div className="organizer-brand">
                  <img
                    src={selectedChampionship?.tenant?.logoUrl || '/assets/logo.png'}
                    alt={`Logo ${selectedChampionship?.tenant?.nome || 'Arena'}`}
                  />
                  <div>
                    <strong>{selectedChampionship?.tenant?.nome || '-'}</strong>
                    <p>Organizador: {selectedChampionship?.organizador?.nome || 'Dono da arena'}</p>
                  </div>
                </div>
                <div className="summary-line"><span>Inicio</span><strong>{toDateTime(selectedChampionship?.dataInicio)}</strong></div>
                <div className="summary-line"><span>Fim</span><strong>{toDateTime(selectedChampionship?.dataFim)}</strong></div>
                <div className="summary-line"><span>Inscritos</span><strong>{selectedChampionship?._count?.inscricoes || 0}/{selectedChampionship?.maxParticipantes || 0}</strong></div>
                <div className="summary-line total"><span>Valor da inscricao</span><strong>{toMoney(selectedChampionship?.valorInscricaoCentavos || 0)}</strong></div>
                <button
                  onClick={() => enrollChampionship(selectedChampionship?.id, selectedChampionship?.tenantId)}
                  disabled={loading || !selectedChampionship?.id}
                >
                  Confirmar inscricao
                </button>
              </article>
            </div>
          </section>
        ) : null}

        {isDetailPage ? (
          <section className="arena-detail-page">
            <div className="detail-back">
              <button className="ghost" onClick={goToHome}>← Voltar para explorar</button>
            </div>
            <div className="detail-hero" style={{ backgroundImage: `url('${selectedTenant?.imagemUrl || FEATURED_IMAGES[0]}')` }}>
              <div className="detail-hero-overlay" />
              <div className="detail-hero-content">
                <span className="detail-sport-pill">{mapSportLabel(search.esporte || 'FUTEBOL')}</span>
                <h2>{selectedTenant?.nome || 'Arena'}</h2>
                <p>Rua das Palmeiras, 450 - São Paulo, SP</p>
              </div>
            </div>

            <div className="detail-main-grid">
              <div className="detail-left">
                <article className="detail-card">
                  <p className="rating-line">★★★★★ {reviews?.mediaNotas || 0} ({reviews?.totalAvaliacoes || 0} avaliacoes)</p>
                  <p>Estrutura premium com quadras de alta qualidade, iluminacao noturna e vestiarios completos.</p>
                  <div className="feature-chips">
                    <span>Estacionamento</span>
                    <span>Vestiario</span>
                    <span>Iluminacao</span>
                    <span>Gramado sintetico</span>
                    <span>Chuveiro</span>
                  </div>
                </article>

                <article className="detail-card">
                  <h3>Horarios Disponiveis</h3>
                  <div className="day-selector">
                    {dateOptions.map((option) => (
                      <button
                        key={option.iso}
                        className={activeDayOffset === option.offset ? 'active' : ''}
                        onClick={() => {
                          setActiveDayOffset(option.offset);
                          setSearch((old) => ({ ...old, data: option.iso }));
                          setSelectedSlotIds([]);
                        }}
                      >
                        <small>{option.label}</small>
                        <strong>{option.dayNumber}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="courts-tabs">
                    {visibleCourts.map((court) => (
                      <button
                        key={court.id}
                        className={court.id === selectedCourtId ? 'active' : ''}
                        onClick={() => {
                          setSelectedCourtId(court.id);
                          setSelectedSlotIds([]);
                        }}
                      >
                        {court.nome}
                      </button>
                    ))}
                  </div>

                  <div className="slot-grid-detail">
                    {visibleSlots.map((slot) => (
                      <button
                        key={slot.id}
                        className={selectedSlotIds.includes(slot.id) ? 'active' : ''}
                        onClick={() => toggleSlotSelection(slot.id)}
                      >
                        {new Date(slot.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ))}
                  </div>
                  {visibleSlots.length === 0 ? <p className="empty">Nenhum horario disponivel para esta data.</p> : null}
                </article>

                <article className="detail-card">
                  <h3>Campeonatos da Arena</h3>
                  {championships.length === 0 ? <p className="empty">Nenhum campeonato aberto no momento.</p> : null}
                  <div className="championship-list">
                    {championships.map((camp) => (
                      <article key={camp.id}>
                        <div>
                          <strong>{camp.nome}</strong>
                          <p>{mapSportLabel(camp.tipoEsporte)} • {toDateTime(camp.dataInicio)} até {toDateTime(camp.dataFim)}</p>
                          <p>{toMoney(camp.valorInscricaoCentavos)} • {camp._count?.inscricoes || 0}/{camp.maxParticipantes} inscritos</p>
                        </div>
                        <button onClick={() => enrollChampionship(camp.id, selectedTenantId)} disabled={loading}>
                          Inscrever
                        </button>
                      </article>
                    ))}
                  </div>
                </article>

                {isUser ? (
                  <article className="detail-card">
                    <h3>Avaliar Arena</h3>
                    {!canReviewSelectedTenant ? (
                      <p className="empty">
                        Voce precisa ter uma reserva valida nessa arena para enviar avaliacao.
                      </p>
                    ) : (
                    <form className="review-form" onSubmit={submitReview}>
                      <label>
                        Nota
                        <select
                          value={reviewForm.nota}
                          onChange={(event) =>
                            setReviewForm((old) => ({ ...old, nota: Number(event.target.value) }))
                          }
                        >
                          <option value={5}>5 - Excelente</option>
                          <option value={4}>4 - Muito bom</option>
                          <option value={3}>3 - Bom</option>
                          <option value={2}>2 - Regular</option>
                          <option value={1}>1 - Ruim</option>
                        </select>
                      </label>
                      <label>
                        Comentario
                        <textarea
                          rows={3}
                          value={reviewForm.comentario}
                          onChange={(event) =>
                            setReviewForm((old) => ({ ...old, comentario: event.target.value }))
                          }
                          placeholder="Conte como foi sua experiencia nessa arena"
                        />
                      </label>
                      <button type="submit" disabled={loading}>Enviar avaliacao</button>
                    </form>
                    )}
                  </article>
                ) : null}
              </div>

              <aside className="detail-right">
                <article className="summary-card">
                  <h3>{toMoney(selectedSlots[0]?.precoCentavos || 0)}<small>/hora</small></h3>
                  <p>{selectedSlotIds.length > 0 ? `${selectedSlotIds.length} horario(s) selecionado(s)` : 'Selecione horarios para continuar'}</p>
                  <div className="summary-line"><span>Valor por hora</span><strong>{toMoney(selectedSlots[0]?.precoCentavos || 0)}</strong></div>
                  <div className="summary-line"><span>Subtotal</span><strong>{toMoney(subtotalSelected)}</strong></div>
                  <div className="summary-line"><span>Taxa de servico</span><strong>{toMoney(serviceFee)}</strong></div>
                  <div className="summary-line total"><span>Total</span><strong>{toMoney(totalSelected)}</strong></div>
                  <button onClick={reserveSelectedSlots} disabled={loading || selectedSlotIds.length === 0}>Reservar Agora</button>
                </article>
              </aside>
            </div>
          </section>
        ) : null}

        {isUser && !isDetailPage && !isChampionshipPage ? (
          <section className="my-bookings" id="meus-agendamentos">
            <div className="section-title">
              <h2>Meus Agendamentos</h2>
              <p>{myBookings.length} registros</p>
            </div>
            <div className="booking-list">
              {myBookings.map((booking) => (
                <article key={booking.id}>
                  <div>
                    <strong>{booking.tenant?.nome}</strong>
                    <p>{booking.quadra?.nome}</p>
                    <p>{toDateTime(booking.slot?.inicioEm)}</p>
                  </div>
                  <div className="booking-actions">
                    <small>{booking.status}</small>
                    <button className="ghost" disabled={booking.status === 'CANCELADA'} onClick={() => cancelBooking(booking.id)}>
                      Cancelar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {showAuth ? (
        <div className="auth-modal-backdrop" onClick={() => setShowAuth(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{authForm.mode === 'entrar' ? 'Entrar' : 'Cadastrar'}</h3>
            <div className="mode-switch">
              <button className={authForm.mode === 'entrar' ? 'active' : ''} onClick={() => setAuthForm((old) => ({ ...old, mode: 'entrar' }))}>Entrar</button>
              <button className={authForm.mode === 'registrar' ? 'active' : ''} onClick={() => setAuthForm((old) => ({ ...old, mode: 'registrar' }))}>Cadastrar</button>
            </div>
            <form onSubmit={loginOrRegister}>
              {authForm.mode === 'registrar' ? (
                <input placeholder="Nome" value={authForm.nome} onChange={(event) => setAuthForm((old) => ({ ...old, nome: event.target.value }))} required />
              ) : null}
              <input type="email" placeholder="Email" value={authForm.email} onChange={(event) => setAuthForm((old) => ({ ...old, email: event.target.value }))} required />
              <input type="password" placeholder="Senha" minLength={8} value={authForm.senha} onChange={(event) => setAuthForm((old) => ({ ...old, senha: event.target.value }))} required />
              <button type="submit" disabled={loading}>{authForm.mode === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
            </form>
          </div>
        </div>
      ) : null}

      <footer className="footer">ArenaBook conectado em {API_URL}</footer>
    </div>
  );
}

export default App;
